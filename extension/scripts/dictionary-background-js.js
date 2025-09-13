// Add this to your existing background.js file

// Dictionary API configuration
const DICTIONARY_API = {
    baseUrl: 'https://law.moj.gov.tw/LawClass/', // Taiwan MOJ Law Database
    searchEndpoint: 'LawSearchContent.aspx',
    lawEndpoint: 'LawAll.aspx'
};

// Enhanced message listener with dictionary support
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'queryLegalReference':
            handleLegalQuery(message, sendResponse);
            return true;
            
        case 'showLegalModal':
            handleShowModal(message, sender);
            break;
            
        case 'searchLawDictionary':
            handleDictionarySearch(message, sendResponse);
            return true;
            
        case 'fetchLawContent':
            handleFetchLawContent(message, sendResponse);
            return true;
            
        default:
            break;
    }
});

// Dictionary search handler
async function handleDictionarySearch(message, sendResponse) {
    try {
        const { query } = message;
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
        
        // If no cached results, make API call
        const results = await searchLawDatabase(query);
        
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
async function handleFetchLawContent(message, sendResponse) {
    try {
        const { lawName } = message;
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
        
        // Fetch from API
        const lawContent = await fetchLawFromAPI(lawName);
        
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

// Search law database via API
async function searchLawDatabase(query) {
    try {
        // Construct search parameters
        const searchParams = new URLSearchParams({
            search: query,
            type: 'all',
            searchMode: 'contain'
        });
        
        // For now, return mock data - replace with actual API call
        // In production, you would make an actual fetch request to your backend
        const mockResults = generateMockSearchResults(query);
        
        return mockResults;
        
    } catch (error) {
        console.error('Law database search error:', error);
        throw error;
    }
}

// Fetch specific law from API
async function fetchLawFromAPI(lawName) {
    try {
        // In production, make actual API call
        // For now, return mock data based on law name
        const mockData = generateMockLawContent(lawName);
        
        return mockData;
        
    } catch (error) {
        console.error('Fetch law API error:', error);
        throw error;
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

// Clean expired cache periodically
function cleanExpiredCache() {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const keysToRemove = [];
        
        Object.keys(items).forEach(key => {
            if (items[key].expiry && items[key].expiry < now) {
                keysToRemove.push(key);
            }
        });
        
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
            console.log(`🧹 Cleaned ${keysToRemove.length} expired cache entries`);
        }
    });
}

// Run cache cleanup every hour
setInterval(cleanExpiredCache, 3600000);

// Initialize dictionary on install/update
chrome.runtime.onInstalled.addListener(() => {
    console.log('📖 Dictionary feature initialized');
    
    // Set default dictionary settings
    chrome.storage.local.set({
        dictionary_settings: {
            enableAutoSearch: true,
            maxSearchResults: 20,
            cacheEnabled: true,
            cacheDuration: 3600
        }
    });
});