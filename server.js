const express = require('express');
const cors = require('cors');
const { mockCases, findSimilarCase } = require('./mockDatabase');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Local cache to store case data
const caseCache = {};

// API endpoint to provide case summaries (mock data only)
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

    console.log(`Request for case: ${cacheKey}`);

    let mockResult;

    // Check if we have an exact match in our mock database
    if (hasMockData) {
      mockResult = mockCases[mockKey];
      console.log(`Found exact match for ${mockKey}`);
    } else {
      // Try to find a similar case
      mockResult = findSimilarCase(year, caseType, number);
      console.log(`Using similar case data for ${mockKey}`);
    }

    const result = {
      ...mockResult,
      sourceUrl: `https://law.judicial.gov.tw/FJUD/data.aspx?q=jrec;js=0;jyear=${year};jcase=${encodeURIComponent(caseType)};jno=${number}`,
      source: "mock",
      notice: "此為本地模擬資料僅供演示功能。實際案件資訊請直接訪問司法院網站。"
    };

    // Store in cache
    caseCache[cacheKey] = result;

    // Return mock data
    return res.json(result);

  } catch (error) {
    console.error('Server error:', error.message);

    res.status(500).json({
      error: '伺服器錯誤，請稍後再試',
      details: error.message
    });
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'mock-only',
    message: '此版本僅提供模擬資料，不會連接外部網站',
    timestamp: new Date().toISOString(),
    canAccessJudicial: false
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    mode: 'mock-only',
    timestamp: new Date().toISOString()
  });
});

// Information endpoint
app.get('/info', (req, res) => {
  res.json({
    name: '法源探測器 (Precedent) - 演示版',
    description: '此版本僅提供模擬資料，不會對司法院網站進行任何請求',
    version: '1.0-mock',
    features: [
      '台灣法律案號自動偵測',
      '本地模擬案件資料',
      '智能彈出視窗定位',
      '響應式設計'
    ],
    note: '尊重 robots.txt 規定，不進行任何網站爬取'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`法源探測器後端服務器運行在 http://localhost:${PORT}`);
  console.log(`模式: 僅提供模擬資料 (不連接外部網站)`);
  console.log(`API endpoint: http://localhost:${PORT}/api/case`);
  console.log(`狀態檢查: http://localhost:${PORT}/api/status`);
});