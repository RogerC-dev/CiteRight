// background.js - 法源探測器 (CiteRight) 背景服務腳本
// Enhanced with processed judicial databases and robust API handling

// Load processed databases
let judicialDatabases = {
  interpretations: null,
  courtCases: null,
  apiMapping: null
};

// Load databases on startup
async function loadDatabases() {
  try {
    const interpretationsUrl = chrome.runtime.getURL('processed_data/judicial_interpretations_db.json');
    const courtCasesUrl = chrome.runtime.getURL('processed_data/court_cases_db.json');
    const apiMappingUrl = chrome.runtime.getURL('processed_data/api_mapping.json');

    const [interpretationsRes, courtCasesRes, apiMappingRes] = await Promise.all([
      fetch(interpretationsUrl),
      fetch(courtCasesUrl),
      fetch(apiMappingUrl)
    ]);

    judicialDatabases.interpretations = await interpretationsRes.json();
    judicialDatabases.courtCases = await courtCasesRes.json();
    judicialDatabases.apiMapping = await apiMappingRes.json();

    console.log('✅ Judicial databases loaded successfully');
    console.log(`📊 Loaded ${judicialDatabases.interpretations.interpretations.length} interpretations`);
  } catch (error) {
    console.error('❌ Error loading databases:', error);
  }
}

// Initialize databases
loadDatabases();

// Enhanced fetch with retry logic
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(`🔄 Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }
}

// Find interpretation in local database
function findInterpretationInDB(interpNum) {
  if (!judicialDatabases.interpretations) return null;

  return judicialDatabases.interpretations.interpretations.find(
    item => item.number === parseInt(interpNum)
  );
}

// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background: Received message:', msg);

  if (msg.type === 'GET_CASE_LINK') {
    const caseStr = msg.caseStr;
    console.log(`Background: Processing case string: ${caseStr}`);

    try {
      // 1. 憲法法庭判決: e.g. "111年憲判字第13號"
      const constMatch = caseStr.match(/(\d{2,3})\s*年\s*憲判字\s*第\s*(\d+)\s*號/);
      if (constMatch) {
        const year = constMatch[1];
        const num = constMatch[2];
        const url = `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${year}憲判字第${num}號`;

        console.log(`Background: Constitutional case detected, URL: ${url}`);
        return sendResponse({
          success: true,
          url: url,
          type: 'constitutional'
        });
      }

      // 2. 大法官解釋: e.g. "釋字第748號" - Enhanced with local database
      const interpMatch = caseStr.match(/釋字第(\d+)號/);
      if (interpMatch) {
        const interpNum = interpMatch[1];

        // Check local database first
        const localResult = findInterpretationInDB(interpNum);
        if (localResult) {
          console.log(`Background: Found interpretation ${interpNum} in local database`);
          return sendResponse({
            success: true,
            url: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${localResult.fileSetId}`,
            downloadUrl: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${localResult.fileSetId}`,
            type: 'interpretation',
            metadata: localResult,
            source: 'local_database'
          });
        }

        // Fallback to constitutional court URL
        const url = `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${interpNum}`;
        console.log(`Background: Interpretation case detected, using fallback URL: ${url}`);
        return sendResponse({
          success: true,
          url: url,
          type: 'interpretation',
          source: 'fallback'
        });
      }

      // 3. 一般法院判決: e.g. "110年度上字第1234號", "民國110年度上字第1234號"
      const generalMatch = caseStr.match(/(?:民國)?(\d{2,3})\s*年度?\s*([\u4e00-\u9fa5]+?)\s*字\s*第\s*(\d+)\s*號/);
      if (generalMatch) {
        const year = generalMatch[1];
        const caseType = generalMatch[2];
        const caseNum = generalMatch[3];

        // 構建司法院開放資料搜尋 URL
        const query = encodeURIComponent(caseStr.trim());
        const url = `https://opendata.judicial.gov.tw/search?q=${query}`;

        console.log(`Background: General case detected, URL: ${url}`);
        return sendResponse({
          success: true,
          url: url,
          type: 'general',
          metadata: { year, caseType, caseNum }
        });
      }

      // 4. 如果都不匹配，返回通用搜尋
      console.log('Background: No specific pattern matched, using general search');
      const query = encodeURIComponent(caseStr.trim());
      const fallbackUrl = `https://law.judicial.gov.tw/FJUD/default.aspx?q=${query}`;

      return sendResponse({
        success: true,
        url: fallbackUrl,
        type: 'search'
      });

    } catch (error) {
      console.error('Background: Error processing case string:', error);
      return sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // New message type for database queries
  if (msg.type === 'SEARCH_DATABASE') {
    const { query, type } = msg;

    try {
      let results = [];

      if (type === 'interpretations' && judicialDatabases.interpretations) {
        const interpretations = judicialDatabases.interpretations.interpretations;

        if (!query || query.trim() === '') {
          results = interpretations.slice(0, 20);
        } else {
          const searchTerm = query.toLowerCase().trim();
          results = interpretations.filter(item =>
            item.title.toLowerCase().includes(searchTerm) ||
            item.number.toString().includes(searchTerm)
          );
        }
      }

      return sendResponse({
        success: true,
        results: results,
        total: results.length
      });
    } catch (error) {
      console.error('Background: Database search error:', error);
      return sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // Get database statistics
  if (msg.type === 'GET_STATS') {
    const stats = {
      interpretations: {
        total: judicialDatabases.interpretations?.interpretations?.length || 0,
        failed: judicialDatabases.interpretations?.failedDownloads?.length || 0,
        successRate: judicialDatabases.interpretations?.metadata?.downloadSummary?.successRate || 'N/A'
      },
      courtCases: {
        periods: judicialDatabases.courtCases?.periods?.length || 0,
        coverage: judicialDatabases.courtCases?.metadata?.coveragePeriod || null
      }
    };

    return sendResponse({
      success: true,
      stats: stats
    });
  }

  return true; // Keep message channel open for async responses
});

// 擴充功能安裝時的初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('CiteRight extension installed:', details);

  if (details.reason === 'install') {
    console.log('CiteRight: First time installation');
  } else if (details.reason === 'update') {
    console.log('CiteRight: Extension updated');
  }
});

// 擴充功能啟動時的日誌
console.log('CiteRight background service worker loaded successfully');
