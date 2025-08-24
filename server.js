const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const https = require('https');
const { mockCases, findSimilarCase } = require('./mockDatabase');

const app = express();
const PORT = 3000;

// Proxy configuration from environment variables
const PROXY_CONFIG = {
  enabled: !!(process.env.PROXY_HOST && process.env.PROXY_PORT),
  protocol: process.env.PROXY_PROTOCOL || 'https',
  host: process.env.PROXY_HOST,
  port: parseInt(process.env.PROXY_PORT) || 8080,
  auth: process.env.PROXY_AUTH ? {
    username: process.env.PROXY_AUTH.split(':')[0],
    password: process.env.PROXY_AUTH.split(':')[1]
  } : undefined
};

console.log('Proxy configuration:', {
  enabled: PROXY_CONFIG.enabled,
  protocol: PROXY_CONFIG.protocol,
  host: PROXY_CONFIG.host ? PROXY_CONFIG.host : 'not configured',
  port: PROXY_CONFIG.port,
  hasAuth: !!PROXY_CONFIG.auth
});

// Enable CORS for all routes
app.use(cors());

// Create an axios instance with more robust configuration
const axiosInstance = axios.create({
  timeout: 45000, // Increased timeout to 45 seconds
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://law.judicial.gov.tw/',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  maxRedirects: 10,
  // Configure HTTPS agent to handle potential SSL issues
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Allow self-signed certificates
    keepAlive: true,
    timeout: 45000
  }),
  // Add proxy configuration if enabled
  ...(PROXY_CONFIG.enabled && {
    proxy: {
      protocol: PROXY_CONFIG.protocol,
      host: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port,
      ...(PROXY_CONFIG.auth && { auth: PROXY_CONFIG.auth })
    }
  }),
  // Retry configuration
  validateStatus: function (status) {
    return status < 500; // Accept anything less than 500 as valid
  }
});

// Custom DNS resolver function to handle network restrictions
const dns = require('dns').promises;

async function checkConnectivity() {
  try {
    // Try to resolve a well-known domain first
    await dns.lookup('google.com');
    return { hasInternet: true, message: 'Internet connectivity available' };
  } catch (error) {
    return { 
      hasInternet: false, 
      message: 'No internet connectivity detected - running in restricted environment',
      error: error.code 
    };
  }
}

// Enhanced retry function with connectivity awareness
async function retryRequestWithFallback(requestFunc, maxRetries = 3, baseDelay = 1000) {
  const connectivityCheck = await checkConnectivity();
  
  if (!connectivityCheck.hasInternet) {
    console.log('Network restrictions detected:', connectivityCheck.message);
    throw new Error(`NETWORK_RESTRICTED: ${connectivityCheck.message}`);
  }
  
  // Log proxy configuration for debugging
  if (PROXY_CONFIG.enabled) {
    console.log(`Using proxy: ${PROXY_CONFIG.protocol}://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
  } else {
    console.log('Direct connection (no proxy configured)');
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}${PROXY_CONFIG.enabled ? ' via proxy' : ''}`);
      const result = await requestFunc();
      return result;
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      // Add proxy-specific error handling
      if (PROXY_CONFIG.enabled && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
        console.log('Proxy connection issue detected. Check proxy server status.');
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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
      // Use retry logic for fetching data with connectivity awareness
      const response = await retryRequestWithFallback(async () => {
        console.log(`Attempting to fetch: ${targetURL}`);
        return await axiosInstance.get(targetURL);
      }, 3, 2000); // 3 retries with 2-second base delay

      // Parse HTML with cheerio
      const $ = cheerio.load(response.data);
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response content length: ${response.data.length}`);
      console.log(`Page title: ${$('title').text()}`);

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
        'td:contains("主文")',
        'div:contains("主文")',
        'div.text',
        'div.active',
        'pre',
        'textarea',
        'span:contains("主文")',
        '.judgment-content',
        '.case-content',
        // More specific selectors for Taiwan judicial system
        'table td',
        'table tr td:nth-child(2)',
        '.table td:nth-child(2)'
      ];

      for (const selector of summarySelectors) {
        const element = $(selector);
        if (element.length && element.text().trim() && element.text().trim().length > 10) {
          summary = element.text().trim().substring(0, 500); // Limit to 500 chars
          console.log(`Found summary using selector: ${selector}`);
          break;
        }
      }

      // Extract court name with better patterns
      const courtSelectors = [
        'td:contains("審理法院")',
        'td:contains("法院")',
        'td:contains("機關")',
        '.court-name',
        'span:contains("法院")',
        // Look for court in table structure
        'table tr:contains("法院") td:last-child',
        'table tr:contains("審理") td:last-child'
      ];

      for (const selector of courtSelectors) {
        const element = $(selector);
        if (element.length && element.text().trim()) {
          court = element.text().trim().replace(/審理法院|機關|法院|：|:/g, '').trim();
          console.log(`Found court using selector: ${selector}`);
          if (court.length > 2) break; // Only accept meaningful court names
        }
      }

      // Extract date with better patterns
      const dateSelectors = [
        'td:contains("判決日期")',
        'td:contains("裁判日期")',
        'td:contains("日期")',
        '.judgment-date',
        'span:contains("年") span:contains("月")',
        // Look for date patterns in table structure
        'table tr:contains("日期") td:last-child',
        'table tr:contains("判決") td:last-child'
      ];

      for (const selector of dateSelectors) {
        const element = $(selector);
        if (element.length && element.text().trim()) {
          date = element.text().trim().replace(/判決日期|裁判日期|日期|：|:/g, '').trim();
          console.log(`Found date using selector: ${selector}`);
          if (date.match(/\d{2,3}年/)) break; // Look for year pattern
        }
      }

      // If no specific data found, try to extract from page structure
      if (!summary && !court && !date) {
        console.log('No structured data found, trying alternative extraction...');
        
        const pageTitle = $('title').text();
        const metaDescription = $('meta[name="description"]').attr('content');
        
        // Look for any table data that might contain case information
        const tableCells = $('table td');
        tableCells.each((i, cell) => {
          const text = $(cell).text().trim();
          if (text.length > 20 && !summary) {
            summary = text.substring(0, 300);
            console.log('Found summary in table cell');
          }
        });

        if (pageTitle && pageTitle.length > 10) {
          if (!summary) summary = pageTitle;
        } else if (metaDescription && metaDescription.length > 10) {
          if (!summary) summary = metaDescription;
        }
        
        // Log page structure for debugging
        console.log('Page structure:');
        console.log('- Tables found:', $('table').length);
        console.log('- Divs found:', $('div').length);
        console.log('- First 200 chars of body:', $('body').text().substring(0, 200));
      }

      console.log('Extraction results:', {
        summary: summary ? `${summary.substring(0, 50)}...` : 'none',
        court: court || 'none',
        date: date || 'none'
      });

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
      console.error('Error scraping case data after all retries:', fetchError.message);
      
      // Provide specific error handling based on error type
      if (fetchError.message.includes('NETWORK_RESTRICTED')) {
        console.error('=== NETWORK RESTRICTION DETECTED ===');
        console.error('The current environment has network restrictions that prevent');
        console.error('access to external websites including law.judicial.gov.tw.');
        console.error('This is common in sandboxed or restricted environments.');
        console.error('Falling back to mock data to demonstrate functionality.');
        console.error('=====================================');
      } else {
        console.error('Error details:', {
          code: fetchError.code,
          errno: fetchError.errno,
          syscall: fetchError.syscall,
          hostname: fetchError.hostname,
          address: fetchError.address,
          port: fetchError.port
        });
        
        // Check specific error types
        if (fetchError.code === 'ENOTFOUND') {
          console.error('DNS resolution failed. This might be due to network restrictions or firewall blocking.');
        } else if (fetchError.code === 'ECONNREFUSED') {
          console.error('Connection refused. The server might be down or blocking requests.');
        } else if (fetchError.code === 'ETIMEDOUT') {
          console.error('Request timed out. The server is taking too long to respond.');
        }
      }
      
      useMockData = true;
    }

    // If we reach here, we need to use mock data
    if (useMockData) {
      console.log(`Using mock data for ${cacheKey}`);

      let mockResult;
      let notice = "司法院網站目前無法連線，此為本地模擬資料僅供參考";

      // Check connectivity to provide more specific notice
      const connectivityCheck = await checkConnectivity();
      if (!connectivityCheck.hasInternet) {
        notice = "當前運行環境無法訪問外部網絡，使用本地模擬資料僅供演示";
      }

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
        notice: notice
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
app.get('/api/status', async (req, res) => {
  const connectivityCheck = await checkConnectivity();
  
  if (!connectivityCheck.hasInternet) {
    return res.json({ 
      status: 'restricted',
      message: connectivityCheck.message,
      timestamp: new Date().toISOString(),
      canAccessJudicial: false,
      proxy: {
        enabled: PROXY_CONFIG.enabled,
        configured: !!PROXY_CONFIG.host
      }
    });
  }
  
  try {
    await retryRequestWithFallback(async () => {
      return await axiosInstance.get('https://law.judicial.gov.tw', { timeout: 10000 });
    }, 2, 1000);
    res.json({ 
      status: 'online',
      canAccessJudicial: true,
      timestamp: new Date().toISOString(),
      proxy: {
        enabled: PROXY_CONFIG.enabled,
        host: PROXY_CONFIG.enabled ? PROXY_CONFIG.host : null,
        port: PROXY_CONFIG.enabled ? PROXY_CONFIG.port : null,
        protocol: PROXY_CONFIG.enabled ? PROXY_CONFIG.protocol : null
      }
    });
  } catch (error) {
    res.json({ 
      status: 'offline', 
      error: error.message,
      canAccessJudicial: false,
      timestamp: new Date().toISOString(),
      proxy: {
        enabled: PROXY_CONFIG.enabled,
        configured: !!PROXY_CONFIG.host,
        error: PROXY_CONFIG.enabled ? 'Proxy connection may be failing' : null
      }
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug endpoint to test external connectivity
app.get('/api/debug/:year/:caseType/:number', async (req, res) => {
  const { year, caseType, number } = req.params;
  const targetURL = `https://law.judicial.gov.tw/FJUD/data.aspx?q=jrec;js=0;jyear=${year};jcase=${encodeURIComponent(caseType)};jno=${number}`;
  
  const connectivityCheck = await checkConnectivity();
  
  if (!connectivityCheck.hasInternet) {
    return res.json({
      success: false,
      error: 'Network restricted environment',
      connectivity: connectivityCheck,
      url: targetURL,
      message: 'Cannot test external connectivity in this environment'
    });
  }
  
  try {
    console.log(`Debug fetch: ${targetURL}`);
    const response = await axiosInstance.get(targetURL, { timeout: 15000 });
    
    res.json({
      success: true,
      status: response.status,
      headers: response.headers,
      contentLength: response.data.length,
      contentPreview: response.data.substring(0, 500),
      url: targetURL,
      connectivity: connectivityCheck
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
      url: targetURL,
      connectivity: connectivityCheck
    });
  }
});

// Network connectivity test endpoint
app.get('/api/network', async (req, res) => {
  const connectivityCheck = await checkConnectivity();
  
  const tests = [
    { name: 'DNS Resolution', test: 'google.com' },
    { name: 'Judicial Website', test: 'law.judicial.gov.tw' }
  ];
  
  const results = [];
  
  for (const testCase of tests) {
    try {
      await dns.lookup(testCase.test);
      results.push({ 
        name: testCase.name, 
        host: testCase.test, 
        status: 'success',
        message: 'DNS resolution successful' 
      });
    } catch (error) {
      results.push({ 
        name: testCase.name, 
        host: testCase.test, 
        status: 'failed',
        error: error.code,
        message: error.message 
      });
    }
  }
  
  res.json({
    connectivity: connectivityCheck,
    tests: results,
    proxy: {
      enabled: PROXY_CONFIG.enabled,
      configuration: PROXY_CONFIG.enabled ? {
        protocol: PROXY_CONFIG.protocol,
        host: PROXY_CONFIG.host,
        port: PROXY_CONFIG.port,
        hasAuth: !!PROXY_CONFIG.auth
      } : null
    },
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`法源探測器後端服務器運行在 http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/case`);
});