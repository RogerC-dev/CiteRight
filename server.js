const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// API endpoint to fetch case summary
app.get('/api/case', async (req, res) => {
  try {
    const { year, caseType, number } = req.query;
    
    if (!year || !caseType || !number) {
      return res.status(400).json({
        error: '缺少必要參數: year, caseType, number'
      });
    }
    
    // Construct target URL for 司法院法學資料檢索系統
    const targetURL = `https://law.judicial.gov.tw/FJUD/data.aspx?q=jrec;js=0;jyear=${year};jcase=${encodeURIComponent(caseType)};jno=${number}`;
    
    console.log(`Fetching: ${targetURL}`);
    
    // Fetch the HTML page
    const response = await axios.get(targetURL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);
    
    // Extract case information (you may need to adjust these selectors based on actual HTML structure)
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
      'td:contains("摘要")'
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
    
    // Return scraped data
    res.json({
      summary: summary || '無法取得摘要資料',
      court: court || '無法取得法院資料',
      date: date || '無法取得日期資料',
      sourceUrl: targetURL
    });
    
  } catch (error) {
    console.error('Error scraping case data:', error.message);
    
    res.status(500).json({
      error: '無法取得判決資料，請稍後再試',
      details: error.message
    });
  }
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