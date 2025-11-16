// background.js - 法源探測器 (CiteRight) 背景服務腳本
// Enhanced with processed judicial databases and robust API handling

// API configuration
const API_BASE_URL = 'http://localhost:3000';

// Database connection status
let databaseStatus = {
    connected: false,
    lastChecked: null,
    stats: null
};

// Check database connection and get stats
async function checkDatabaseConnection() {
    try {
        const response = await fetchWithRetry(`${API_BASE_URL}/health`);
        const healthData = await response.json();

        databaseStatus.connected = healthData.status === 'OK' && healthData.database?.connected;
        databaseStatus.lastChecked = new Date();

        if (databaseStatus.connected) {
            console.log('✅ Database connection verified');
            // Get database statistics
            const statsResponse = await fetchWithRetry(`${API_BASE_URL}/api/debug`);
            databaseStatus.stats = await statsResponse.json();
        } else {
            console.warn('⚠️ Database connection failed');
        }
    } catch (error) {
        console.error('❌ Error checking database connection:', error);
        databaseStatus.connected = false;
    }
}

// Initialize database connection
checkDatabaseConnection();

// Create context menu on extension startup
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.runtime.onInstalled.addListener(createContextMenu);

function createContextMenu() {
    chrome.contextMenus.create({
        id: "activate-citeright",
        title: "⚖️ 啟用台灣法源探測器",
        contexts: ["selection", "page"]
    });

    chrome.contextMenus.create({
        id: "deactivate-citeright",
        title: "❌ 停用台灣法源探測器",
        contexts: ["page"]
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "activate-citeright") {
        chrome.tabs.sendMessage(tab.id, {
            action: "activateCiteRight",
            selectedText: info.selectionText || null
        });
        console.log('⚖️ 透過右鍵選單啟用台灣法源探測器');
    } else if (info.menuItemId === "deactivate-citeright") {
        chrome.tabs.sendMessage(tab.id, {
            action: "deactivateCiteRight"
        });
        console.log('❌ 透過右鍵選單停用台灣法源探測器');
    }
});

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

// Find interpretation using API
async function findInterpretationInDB(interpNum) {
    if (!databaseStatus.connected) {
        console.warn('Database not connected, cannot search interpretations');
        return null;
    }

    try {
        const response = await fetchWithRetry(
            `${API_BASE_URL}/api/case?caseType=釋字&number=${interpNum}`
        );

        if (!response.ok) {
            console.warn(`No interpretation found for number: ${interpNum}`);
            return null;
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error finding interpretation in database:', error);
        return null;
    }
}

// 監聽來自 content script 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('Background: Received message:', msg);

    // Handle async operations properly
    if (msg.type === 'GET_CASE_LINK') {
        handleCaseLinkRequest(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    if (msg.type === 'SEARCH_DATABASE') {
        handleDatabaseSearch(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    if (msg.type === 'GET_STATS') {
        handleGetStats(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    // Handle dictionary search requests
    if (msg.action === 'searchLawDictionary') {
        handleDictionarySearch(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    // Handle law content fetch requests
    if (msg.action === 'fetchLawContent') {
        handleFetchLawContent(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    // Handle API proxy requests from content scripts (bypasses CORS)
    if (msg.type === 'API_REQUEST') {
        handleApiRequest(msg, sendResponse);
        return true; // Keep message channel open for async response
    }

    // Handle other message types synchronously
    handleOtherMessages(msg, sendResponse);
    return true; // Keep message channel open for async response
});

// Async handler for GET_CASE_LINK
async function handleCaseLinkRequest(msg, sendResponse) {
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

        // 2. 大法官解釋: e.g. "釋字第748號" - Enhanced with MySQL database
        const interpMatch = caseStr.match(/釋字第(\d+)號/);
        if (interpMatch) {
            const interpNum = interpMatch[1];

            try {
                // Check database via API
                const dbResult = await findInterpretationInDB(interpNum);
                if (dbResult) {
                    console.log(`Background: Found interpretation ${interpNum} in database`);

                    // Construct URL from database result
                    const url = dbResult.data?.url || dbResult.source_url ||
                        `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${interpNum}`;

                    return sendResponse({
                        success: true,
                        url: url,
                        type: 'interpretation',
                        metadata: dbResult,
                        source: 'mysql_database'
                    });
                }
            } catch (error) {
                console.error('Error querying database for interpretation:', error);
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

// Async handler for database search
async function handleDatabaseSearch(msg, sendResponse) {
    const { query, type } = msg;

    try {
        let results = [];

        if (type === 'interpretations' && databaseStatus.connected) {
            if (!query || query.trim() === '') {
                // Get recent interpretations
                const response = await fetchWithRetry(`${API_BASE_URL}/api/case/recent?limit=20`);
                if (response.ok) {
                    const data = await response.json();
                    results = data.results || [];
                }
            } else {
                // Search interpretations by query
                const searchQuery = encodeURIComponent(query.trim());
                const response = await fetchWithRetry(
                    `${API_BASE_URL}/api/case/search?q=${searchQuery}&type=interpretation`
                );
                if (response.ok) {
                    const data = await response.json();
                    results = data.results || [];
                }
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

// Async handler for getting stats
async function handleGetStats(msg, sendResponse) {
    try {
        if (!databaseStatus.connected) {
            await checkDatabaseConnection();
        }

        const stats = databaseStatus.stats || {
            interpretations: { total: 0, available: 0 },
            database: { connected: databaseStatus.connected },
            lastChecked: databaseStatus.lastChecked
        };

        return sendResponse({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting database stats:', error);
        return sendResponse({
            success: false,
            error: error.message,
            stats: {
                interpretations: { total: 0 },
                database: { connected: false },
                error: 'Failed to connect to database'
            }
        });
    }
}

// Dictionary search handler
async function handleDictionarySearch(msg, sendResponse) {
    try {
        const { query } = msg;
        console.log('🔍 Dictionary search for:', query);

        // First, try to search in cached data
        const cachedResults = searchCachedLaws(query);

        if (cachedResults.length > 0) {
            sendResponse({
                success: true,
                results: cachedResults
            });
            return;
        }

        // If no cached results, generate mock results for now
        // In production, this would make actual API calls
        const results = generateMockSearchResults(query);

        sendResponse({
            success: true,
            results: results
        });

    } catch (error) {
        console.error('Dictionary search error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Fetch specific law content
async function handleFetchLawContent(msg, sendResponse) {
    try {
        const { lawName } = msg;
        console.log('📖 Fetching law content for:', lawName);

        // Check cache first
        const cacheKey = `law_content_${lawName}`;
        const cached = await getCachedData(cacheKey);

        if (cached) {
            sendResponse({
                success: true,
                data: cached
            });
            return;
        }

        // Generate mock law content for now
        // In production, this would make actual API calls
        const lawContent = generateMockLawContent(lawName);

        // Cache the result
        await setCachedData(cacheKey, lawContent, 3600); // Cache for 1 hour

        sendResponse({
            success: true,
            data: lawContent
        });

    } catch (error) {
        console.error('Fetch law content error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// API proxy handler - allows content scripts to make API requests through background script
async function handleApiRequest(msg, sendResponse) {
    try {
        const { endpoint, method = 'GET', body, headers = {} } = msg;

        if (!endpoint) {
            return sendResponse({
                success: false,
                error: 'Missing endpoint in API request'
            });
        }

        const url = endpoint.startsWith('http')
            ? endpoint
            : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

        console.log(`🌐 Background: Proxying API request to ${url}`);

        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetchWithRetry(url, fetchOptions);
        const data = await response.json();

        return sendResponse({
            success: true,
            data: data,
            status: response.status
        });

    } catch (error) {
        console.error('Background: API proxy error:', error);
        return sendResponse({
            success: false,
            error: error.message || 'API request failed'
        });
    }
}

// Search cached laws (for quick results)
function searchCachedLaws(query) {
    // Common laws database (simplified)
    const commonLaws = [
        { lawName: '民法', articles: ['第1條', '第184條', '第195條', '第965條'] },
        { lawName: '刑法', articles: ['第1條', '第271條', '第339條'] },
        { lawName: '勞動基準法', articles: ['第1條', '第32條', '第38條', '第84條'] },
        { lawName: '公司法', articles: ['第1條', '第8條', '第128條'] },
        { lawName: '民事訴訟法', articles: ['第1條', '第244條', '第427條'] }
    ];

    const results = [];
    const lowerQuery = query.toLowerCase();

    commonLaws.forEach(law => {
        if (law.lawName.includes(query)) {
            law.articles.forEach(article => {
                results.push({
                    title: `${law.lawName} ${article}`,
                    lawName: law.lawName,
                    article: article,
                    preview: `${law.lawName}${article}相關條文內容預覽...`,
                    source: '臺灣法規資料庫'
                });
            });
        }
    });

    return results.slice(0, 10); // Return max 10 results
}

// Generate mock search results (replace with actual API in production)
function generateMockSearchResults(query) {
    const mockTemplates = [
        {
            laws: ['民法', '刑法', '勞動基準法', '公司法', '民事訴訟法', '刑事訴訟法'],
            getResult: (law) => ({
                title: `${law} - ${query}相關條文`,
                lawName: law,
                article: `第${Math.floor(Math.random() * 100) + 1}條`,
                preview: `關於「${query}」的規定：本條文規範${query}相關事項，包含定義、範圍與法律效果...`,
                source: '臺灣法規資料庫'
            })
        }
    ];

    const results = [];
    const template = mockTemplates[0];

    // Generate 3-5 results
    const numResults = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numResults && i < template.laws.length; i++) {
        results.push(template.getResult(template.laws[i]));
    }

    return results;
}

// Generate mock law content (replace with actual API in production)
function generateMockLawContent(lawName) {
    const mockContent = {
        lawName: lawName,
        title: lawName,
        type: 'law',
        lastAmended: '2024-01-15',
        status: 'active',
        chapters: [
            {
                name: '第一章 總則',
                articles: [
                    {
                        number: '1',
                        content: `為規範${lawName}相關事項，特制定本法。`
                    },
                    {
                        number: '2',
                        content: `本法所稱主管機關：在中央為法務部；在直轄市為直轄市政府；在縣（市）為縣（市）政府。`
                    }
                ]
            },
            {
                name: '第二章 權利義務',
                articles: [
                    {
                        number: '3',
                        content: `依本法規定享有權利者，應遵守相關義務規定。`
                    }
                ]
            }
        ],
        totalArticles: 100,
        officialUrl: `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${lawName}`
    };

    return mockContent;
}

// Cache management functions
async function getCachedData(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            const data = result[key];
            if (data && data.expiry > Date.now()) {
                resolve(data.value);
            } else {
                resolve(null);
            }
        });
    });
}

async function setCachedData(key, value, ttlSeconds = 3600) {
    const data = {
        value: value,
        expiry: Date.now() + (ttlSeconds * 1000)
    };

    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: data }, () => {
            resolve();
        });
    });
}

// Handler for other message types
function handleOtherMessages(msg, sendResponse) {
    // Listen for global toggle requests from popup
    if (msg && msg.action === 'GLOBAL_TOGGLE_ENABLE_STATE') {
        console.log('🔄 Global toggle requested:', msg.enabled);
        chrome.storage.local.set({ citeright_enabled: msg.enabled }, () => {
            broadcastEnableState(msg.enabled);
            sendResponse({ success: true });
        });
        return true; // async
    }

    return true; // Keep message channel open for async responses
}

function broadcastEnableState(enabled) {
    console.log('📡 Broadcasting enabled state to all tabs:', enabled);
    try {
        chrome.tabs.query({}, tabs => {
            tabs.forEach(t => {
                if (t.id) {
                    chrome.tabs.sendMessage(t.id, { action: 'setEnabledState', enabled });
                }
            });
        });
    } catch (e) {
        console.warn('Broadcast failed', e);
    }
}

// React to manual storage changes (e.g., from other components)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.citeright_enabled) {
        broadcastEnableState(changes.citeright_enabled.newValue);
    }
});

// 擴充功能安裝時的初始化
chrome.runtime.onInstalled.addListener((details) => {
    console.log('CiteRight extension installed:', details);

    if (details.reason === 'install') {
        console.log('CiteRight: First time installation');

        // Initialize dictionary settings
        chrome.storage.local.set({
            dictionary_settings: {
                enableAutoSearch: true,
                maxSearchResults: 20,
                cacheEnabled: true,
                cacheDuration: 3600
            }
        });
        console.log('📖 Dictionary feature initialized');

    } else if (details.reason === 'update') {
        console.log('CiteRight: Extension updated');
        console.log('📖 Dictionary feature updated');
    }
});

// 擴充功能啟動時的日誌
console.log('CiteRight background service worker loaded successfully');
