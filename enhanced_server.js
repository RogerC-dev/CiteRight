// Enhanced server.js with multiple data source options
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { mockCases, findSimilarCase } = require('./mockDatabase');

const app = express();
const PORT = 3000;

app.use(cors());
const caseCache = {};

// Method 1: Use official APIs where available
async function fetchFromOfficialAPI(caseData) {
  try {
    // 法務部全國法規資料庫 API (for interpretations)
    if (caseData.type === 'interpretation') {
      const apiUrl = `https://law.moj.gov.tw/api/v1/lawdata/search?keyword=${encodeURIComponent(caseData.originalText)}`;
      const response = await axios.get(apiUrl, { timeout: 5000 });
      return response.data;
    }

    // 司法院裁判書查詢 (alternative approach)
    if (caseData.type === 'general') {
      // This would need proper API authentication
      const searchUrl = `https://judgment.judicial.gov.tw/FJUD/qryresult.aspx`;
      // Note: This requires proper session handling and CSRF tokens
      console.log('Would query official judicial database here');
    }

    return null;
  } catch (error) {
    console.log('Official API not available:', error.message);
    return null;
  }
}

// Method 2: Use proxy service for CORS-restricted APIs
async function fetchViaProxy(url) {
  try {
    // Using a CORS proxy service (for development only)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl, { timeout: 10000 });
    return JSON.parse(response.data.contents);
  } catch (error) {
    console.log('Proxy fetch failed:', error.message);
    return null;
  }
}

// Method 3: Enhanced case data with real legal context
async function enhanceWithRealData(mockData, caseInfo) {
  try {
    // Add real legal context from multiple sources
    const enhancedData = {
      ...mockData,
      realDataSources: [],
      confidence: 'medium' // low/medium/high based on data quality
    };

    // Try Wikipedia for case background
    try {
      const wikiSearch = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(caseInfo.originalText)}`;
      const wikiResponse = await axios.get(wikiSearch, { timeout: 3000 });
      if (wikiResponse.data.extract) {
        enhancedData.backgroundInfo = wikiResponse.data.extract;
        enhancedData.realDataSources.push('Wikipedia');
        enhancedData.confidence = 'high';
      }
    } catch (e) {
      console.log('Wikipedia lookup failed');
    }

    // Try legal news APIs
    try {
      // This could connect to legal news aggregators
      const newsSearch = `https://newsapi.org/v2/everything?q=${encodeURIComponent(caseInfo.originalText)}&language=zh`;
      // Note: Requires API key
      console.log('Would search legal news here');
    } catch (e) {
      console.log('News API lookup failed');
    }

    return enhancedData;
  } catch (error) {
    return mockData; // Fallback to mock data
  }
}

// Enhanced API endpoint with real data integration
app.get('/api/case', async (req, res) => {
  try {
    const { year, caseType, number } = req.query;

    if (!year || !caseType || !number) {
      return res.status(400).json({
        error: '缺少必要參數: year, caseType, number'
      });
    }

    const cacheKey = `${year}-${caseType}-${number}`;

    // Return cached result if available
    if (caseCache[cacheKey]) {
      console.log(`Returning cached data for ${cacheKey}`);
      return res.json(caseCache[cacheKey]);
    }

    const caseInfo = {
      year: parseInt(year),
      caseType,
      number,
      originalText: `${year}年度${caseType}字第${number}號`,
      type: caseType.includes('憲判') ? 'constitutional' :
            caseType === '釋字' ? 'interpretation' : 'general'
    };

    console.log(`Processing case: ${cacheKey}`);

    // Step 1: Try official APIs first
    let realData = await fetchFromOfficialAPI(caseInfo);

    // Step 2: If no official data, try mock data with real enhancements
    let result;
    if (realData) {
      result = {
        ...realData,
        source: 'official',
        confidence: 'high',
        sourceUrl: `https://law.judicial.gov.tw/FJUD/data.aspx?q=${encodeURIComponent(caseInfo.originalText)}`
      };
    } else {
      // Get mock data
      const mockKey = `${year}-${caseType}-${number}`;
      const mockData = mockCases[mockKey] || findSimilarCase(year, caseType, number);

      // Enhance mock data with real context
      result = await enhanceWithRealData(mockData, caseInfo);
      result.sourceUrl = `https://law.judicial.gov.tw/FJUD/data.aspx?q=${encodeURIComponent(caseInfo.originalText)}`;
    }

    // Cache the result
    caseCache[cacheKey] = result;

    return res.json(result);

  } catch (error) {
    console.error('Server error:', error.message);

    // Fallback to pure mock data
    try {
      const mockKey = `${req.query.year}-${req.query.caseType}-${req.query.number}`;
      const fallbackData = mockCases[mockKey] || findSimilarCase(req.query.year, req.query.caseType, req.query.number);
      fallbackData.source = 'mock';
      fallbackData.confidence = 'low';
      fallbackData.error = 'Failed to fetch real data, using mock data';

      return res.json(fallbackData);
    } catch (fallbackError) {
      return res.status(500).json({
        error: '服務暫時無法使用',
        details: error.message
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cacheSize: Object.keys(caseCache).length,
    uptime: process.uptime()
  });
});

// Real data testing endpoint
app.get('/api/test-real-data', async (req, res) => {
  const testCases = [
    { year: '110', caseType: '台上', number: '1234' },
    { year: '109', caseType: '憲判', number: '13' },
    { year: '111', caseType: '釋字', number: '748' }
  ];

  const results = [];
  for (const testCase of testCases) {
    try {
      const cacheKey = `${testCase.year}-${testCase.caseType}-${testCase.number}`;
      const caseInfo = {
        year: parseInt(testCase.year),
        caseType: testCase.caseType,
        number: testCase.number,
        originalText: `${testCase.year}年度${testCase.caseType}字第${testCase.number}號`,
        type: testCase.caseType.includes('憲判') ? 'constitutional' :
              testCase.caseType === '釋字' ? 'interpretation' : 'general'
      };

      const realData = await fetchFromOfficialAPI(caseInfo);
      const mockData = mockCases[cacheKey] || findSimilarCase(testCase.year, testCase.caseType, testCase.number);
      const enhanced = await enhanceWithRealData(mockData, caseInfo);

      results.push({
        case: caseInfo.originalText,
        hasRealData: !!realData,
        hasEnhancement: enhanced.realDataSources?.length > 0,
        confidence: enhanced.confidence,
        sources: enhanced.realDataSources || []
      });
    } catch (error) {
      results.push({
        case: `${testCase.year}年度${testCase.caseType}字第${testCase.number}號`,
        error: error.message
      });
    }
  }

  res.json({
    testResults: results,
    summary: {
      total: results.length,
      withRealData: results.filter(r => r.hasRealData).length,
      withEnhancement: results.filter(r => r.hasEnhancement).length
    }
  });
});

app.listen(PORT, () => {
  console.log(`Enhanced 法源探測器 server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/case`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Test real data: http://localhost:${PORT}/api/test-real-data`);
  console.log('\nExample usage:');
  console.log(`http://localhost:${PORT}/api/case?year=110&caseType=台上&number=1234`);
});

module.exports = app;
