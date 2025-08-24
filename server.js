const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const { mockCases, findSimilarCase } = require('./mockDatabase');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Create an axios instance with more robust configuration
const axiosInstance = axios.create({
  timeout: 15000, // Increased timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://law.judicial.gov.tw/',
    'Connection': 'keep-alive',
  },
  maxRedirects: 5,
  // Add a longer timeout
  timeout: 30000,
});

// Local cache to reduce repeated requests
const caseCache = {};

// API endpoint to fetch case summary
app.get('/api/case', async (req, res) => {
  try {
    const { year, caseType, number } = req.query;
    
    if (!year || !caseType || !number) {
      return res.status(400).json({
        error: '缺少必要參數: year, caseType, number'
      });
    }
    
    // Create a cache key
    const cacheKey = `${year}-${caseType}-${number}`;

    // Return cached result if available
    if (caseCache[cacheKey]) {
      console.log(`Returning cached data for ${cacheKey}`);
      return res.json(caseCache[cacheKey]);
    }

    // Check if we have this case in our mock database
    const mockKey = `${year}-${caseType}-${number}`;
    const hasMockData = mockCases.hasOwnProperty(mockKey);

    // First try to fetch online data
    // Construct target URL for 司法院法學資料檢索系統
    const targetURL = `https://law.judicial.gov.tw/FJUD/data.aspx?q=jrec;js=0;jyear=${year};jcase=${encodeURIComponent(caseType)};jno=${number}`;
    
    console.log(`Fetching: ${targetURL}`);
    
    let useMockData = false;

    try {
      // Fetch the HTML page with a short timeout to fail fast if site is down
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await axiosInstance.get(targetURL, {
        signal: controller.signal
      }).catch(error => {
        console.log("Fast fail, switching to mock data");
        throw error;
      });

      clearTimeout(timeoutId);

      // Parse HTML with cheerio
      const $ = cheerio.load(response.data);

      // Extract case information
      let summary = '';
      let court = '';
      let date = '';

      // Try to extract summary from various possible selectors
      const summarySelectors = [
        '.summary',
        '#summary',
        '.content',
        '.main-content',
        'td:contains("要旨")',
        'td:contains("摘要")',
        'div:contains("主文")',
        'div.text',
        'div.active',
        'pre'
      ];

      for (const selector of summarySelectors) {
        const element = $(selector);
        if (element.length && element.text().trim()) {
          summary = element.text().trim();
          break;
        }
      }

      // Extract court name
      const courtSelectors = [
        'td:contains("審理法院")',
        'td:contains("法院")',
        '.court-name'
      ];

      for (const selector of courtSelectors) {
        const element = $(selector);
        if (element.length && element.text().trim()) {
          court = element.text().trim().replace(/審理法院|法院|：|:/, '');
          break;
        }
      }

      // Extract date
      const dateSelectors = [
        'td:contains("判決日期")',
        'td:contains("裁判日期")',
        '.judgment-date'
      ];

      for (const selector of dateSelectors) {
        const element = $(selector);
        if (element.length && element.text().trim()) {
          date = element.text().trim().replace(/判決日期|裁判日期|：|:/, '');
          break;
        }
      }

      // If no specific data found, try to extract from page title or meta
      if (!summary && !court && !date) {
        const pageTitle = $('title').text();
        const metaDescription = $('meta[name="description"]').attr('content');

        if (pageTitle) {
          summary = pageTitle;
        } else if (metaDescription) {
          summary = metaDescription;
        }
      }

      // Check if we got useful data, otherwise fall back to mock data
      if (!summary && !court && !date) {
        useMockData = true;
      } else {
        // Create the result object with online data
        const result = {
          summary: summary || '無法取得摘要資料',
          court: court || '無法取得法院資料',
          date: date || '無法取得日期資料',
          sourceUrl: targetURL,
          source: "online"
        };

        // Store in cache
        caseCache[cacheKey] = result;

        // Return scraped data
        return res.json(result);
      }

    } catch (fetchError) {
      console.error('Error scraping case data:', fetchError.message);
      useMockData = true;
    }

    // If we reach here, we need to use mock data
    if (useMockData) {
      console.log(`Using mock data for ${cacheKey}`);

      let mockResult;

      // Check if we have an exact match in our mock database
      if (hasMockData) {
        mockResult = mockCases[mockKey];
      } else {
        // Try to find a similar case
        mockResult = findSimilarCase(year, caseType, number);
      }

      const result = {
        ...mockResult,
        sourceUrl: targetURL,
        source: "mock",
        notice: "司法院網站目前無法連線，此為本地模擬資料僅供參考"
      };

      // Store in cache
      caseCache[cacheKey] = result;

      // Return mock data
      return res.json(result);
    }

  } catch (error) {
    console.error('Server error:', error.message);

    // Even in case of server error, try to return mock data if possible
    try {
      const { year, caseType, number } = req.query;
      const mockKey = `${year}-${caseType}-${number}`;
      const mockResult = mockCases[mockKey] || findSimilarCase(year, caseType, number);

      return res.json({
        ...mockResult,
        source: "mock-fallback",
        notice: "系統發生錯誤，此為緊急備用資料"
      });
    } catch (mockError) {
      // If all else fails, return the error
      res.status(500).json({
        error: '伺服器錯誤，請稍後再試',
        details: error.message
      });
    }
  }
});

// New endpoint to check if we're online
app.get('/api/status', (req, res) => {
  axiosInstance.get('https://law.judicial.gov.tw', { timeout: 3000 })
    .then(() => {
      res.json({ status: 'online' });
    })
    .catch(() => {
      res.json({ status: 'offline' });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`法源探測器後端服務器運行在 http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/case`);
});