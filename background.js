// background.js - 法源探測器 (CiteRight) 背景服務腳本
// 根據 IDE AI Prompt 實作，負責生成正確的官方連結

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

      // 2. 大法官解釋: e.g. "釋字第748號"
      const interpMatch = caseStr.match(/釋字第(\d+)號/);
      if (interpMatch) {
        const interpNum = interpMatch[1];
        const url = `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${interpNum}`;

        console.log(`Background: Interpretation case detected, URL: ${url}`);
        return sendResponse({
          success: true,
          url: url,
          type: 'interpretation'
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

        console.log(`Background: General case detected (${year}年${caseType}字第${caseNum}號), URL: ${url}`);
        return sendResponse({
          success: true,
          url: url,
          type: 'general',
          year: year,
          caseType: caseType,
          caseNumber: caseNum
        });
      }

      // 4. 如果沒有匹配到任何模式，使用通用搜尋
      const fallbackQuery = encodeURIComponent(caseStr.trim());
      const fallbackUrl = `https://opendata.judicial.gov.tw/search?q=${fallbackQuery}`;

      console.log(`Background: No specific pattern matched, using fallback URL: ${fallbackUrl}`);
      return sendResponse({
        success: true,
        url: fallbackUrl,
        type: 'fallback'
      });

    } catch (error) {
      console.error('Background: Error processing case string:', error);
      return sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // 對於其他類型的消息，返回錯誤
  console.warn('Background: Unknown message type:', msg.type);
  return sendResponse({
    success: false,
    error: 'Unknown message type'
  });
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
