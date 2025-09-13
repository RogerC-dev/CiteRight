import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDictionaryStore = defineStore('dictionary', () => {
  // State
  const searchQuery = ref('')
  const searchResults = ref([])
  const recentSearches = ref([])
  const isSearching = ref(false)
  const cachedLaws = ref(new Map())
  const searchHistory = ref([])
  
  // Law categories configuration
  const lawCategories = ref([
    {
      title: '⚖️ 民事法規',
      laws: ['民法', '民事訴訟法', '家事事件法', '消費者保護法', '公寓大廈管理條例']
    },
    {
      title: '🚨 刑事法規',
      laws: ['刑法', '刑事訴訟法', '少年事件處理法', '毒品危害防制條例']
    },
    {
      title: '📋 行政法規',
      laws: ['行政程序法', '行政訴訟法', '訴願法', '國家賠償法']
    },
    {
      title: '💼 商事法規',
      laws: ['公司法', '票據法', '證券交易法', '保險法', '海商法']
    },
    {
      title: '👷 勞動法規',
      laws: ['勞動基準法', '勞工保險條例', '勞工退休金條例', '職業安全衛生法']
    }
  ])

  // Computed
  const hasSearchResults = computed(() => searchResults.value.length > 0)
  const recentSearchesDisplay = computed(() => recentSearches.value.slice(0, 4))
  
  // Actions
  
  /**
   * 搜尋法規
   */
  async function searchLaws(query) {
    if (!query || !query.trim()) return
    
    isSearching.value = true
    console.log('🔍 開始搜尋法規:', query)
    
    try {
      // 嘗試直接使用 API Service 搜尋法律資料
      const { searchLegalData, loadLegalNames } = await import('../services/apiService.js')
      
      try {
        // 先嘗試搜尋法律資料
        const results = await searchLegalData(query, { type: 'law' })
        
        if (results && results.length > 0) {
          // 轉換 API 結果為字典格式
          searchResults.value = results.map(result => ({
            title: result.LawName || result.title || query,
            lawName: result.LawName || result.title,
            article: result.ArticleNo || '',
            preview: result.Article || result.description || `${result.LawName || query}相關法規內容`,
            source: '臺灣法規資料庫',
            officialUrl: result.LawUrl || ''
          }))
          console.log('✅ API 搜尋完成:', searchResults.value.length, '筆結果')
          return
        }
      } catch (apiError) {
        console.warn('⚠️ API 搜尋失敗，嘗試載入法律名稱:', apiError.message)
        
        // 如果搜尋失敗，嘗試從法律名稱列表中匹配
        try {
          const legalNames = await loadLegalNames()
          const matchedLaws = legalNames.filter(law => 
            law.LawName && law.LawName.includes(query)
          )
          
          if (matchedLaws.length > 0) {
            searchResults.value = matchedLaws.map(law => ({
              title: law.LawName,
              lawName: law.LawName,
              article: '',
              preview: `${law.LawName} - 點擊查看完整法規內容`,
              source: '臺灣法規資料庫',
              officialUrl: law.LawUrl || ''
            }))
            console.log('✅ 從法律名稱匹配完成:', searchResults.value.length, '筆結果')
            return
          }
        } catch (namesError) {
          console.warn('⚠️ 法律名稱載入失敗:', namesError.message)
        }
      }
      
      // 如果 API 都失敗，回退到背景腳本
      console.log('🔄 回退到背景腳本搜尋')
      const response = await sendMessageToBackground({
        action: 'searchLawDictionary',
        query: query
      })
      
      if (response && response.success) {
        searchResults.value = response.results
        console.log('✅ 背景腳本搜尋完成:', response.results.length, '筆結果')
      } else {
        console.error('❌ 搜尋失敗:', response?.error)
        searchResults.value = []
      }
      
    } catch (error) {
      console.error('💥 搜尋錯誤:', error)
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }
  
  /**
   * 獲取特定法規內容
   */
  async function fetchLawContent(lawName) {
    console.log('📖 獲取法規內容:', lawName)
    
    // 檢查快取
    if (cachedLaws.value.has(lawName)) {
      console.log('📦 使用快取法規:', lawName)
      return cachedLaws.value.get(lawName)
    }
    
    try {
      // 嘗試直接使用 API Service 獲取法規內容
      const { fetchLawInfo } = await import('../services/apiService.js')
      
      try {
        const lawData = await fetchLawInfo(lawName)
        
        if (lawData) {
          // 轉換 API 數據為統一格式
          const formattedContent = {
            lawName: lawData.LawName || lawName,
            title: lawData.LawName || lawName,
            type: 'law',
            lastAmended: lawData.LawModifiedDate ? new Date(lawData.LawModifiedDate).toISOString() : new Date().toISOString(),
            status: 'active',
            chapters: formatLawArticles(lawData.Articles || []),
            totalArticles: lawData.Articles ? lawData.Articles.length : 0,
            officialUrl: lawData.LawUrl || `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${encodeURIComponent(lawName)}`,
            category: lawData.LawCategory,
            level: lawData.LawLevel,
            histories: lawData.LawHistories
          }
          
          // 快取結果
          cachedLaws.value.set(lawName, formattedContent)
          console.log('✅ API 法規內容獲取成功:', lawName)
          return formattedContent
        }
      } catch (apiError) {
        console.warn('⚠️ API 獲取法規失敗，回退到背景腳本:', apiError.message)
      }
      
      // 回退到背景腳本
      const response = await sendMessageToBackground({
        action: 'fetchLawContent',
        lawName: lawName
      })
      
      if (response && response.success) {
        // 快取結果
        cachedLaws.value.set(lawName, response.data)
        console.log('✅ 背景腳本法規內容獲取成功:', lawName)
        return response.data
      } else {
        console.error('❌ 獲取法規內容失敗:', response?.error)
        throw new Error(response?.error || '獲取法規內容失敗')
      }
      
    } catch (error) {
      console.error('💥 獲取法規內容錯誤:', error)
      throw error
    }
  }
  
  /**
   * 格式化法規條文為章節結構
   */
  function formatLawArticles(articles) {
    if (!articles || articles.length === 0) return []
    
    const chapters = []
    let currentChapter = null
    
    articles.forEach(article => {
      // 檢查是否為新章節（通常 CaptionTitle 包含「章」字）
      if (article.CaptionTitle && article.CaptionTitle.includes('章')) {
        currentChapter = {
          name: article.CaptionTitle,
          articles: []
        }
        chapters.push(currentChapter)
      }
      
      // 如果沒有章節，創建一個默認章節
      if (!currentChapter) {
        currentChapter = {
          name: '條文內容',
          articles: []
        }
        chapters.push(currentChapter)
      }
      
      // 添加條文到當前章節
      currentChapter.articles.push({
        number: article.ArticleNo || '',
        title: article.CaptionTitle && !article.CaptionTitle.includes('章') ? article.CaptionTitle : '',
        content: article.Article || ''
      })
    })
    
    return chapters
  }
  
  /**
   * 搜尋快取的法規
   */
  function searchCachedLaws(query) {
    // 常見法規資料庫（簡化版）
    const commonLaws = [
      { lawName: '民法', articles: ['第1條', '第184條', '第195條', '第965條'] },
      { lawName: '刑法', articles: ['第1條', '第271條', '第339條'] },
      { lawName: '勞動基準法', articles: ['第1條', '第32條', '第38條', '第84條'] },
      { lawName: '公司法', articles: ['第1條', '第8條', '第128條'] },
      { lawName: '民事訴訟法', articles: ['第1條', '第244條', '第427條'] }
    ]
    
    const results = []
    const lowerQuery = query.toLowerCase()
    
    commonLaws.forEach(law => {
      if (law.lawName.includes(query)) {
        law.articles.forEach(article => {
          results.push({
            title: `${law.lawName} ${article}`,
            lawName: law.lawName,
            article: article,
            preview: `${law.lawName}${article}相關條文內容預覽...`,
            source: '臺灣法規資料庫'
          })
        })
      }
    })
    
    return results.slice(0, 10)
  }
  
  /**
   * 加入最近搜尋
   */
  function addToRecentSearches(term) {
    const cleanTerm = term.trim()
    if (!cleanTerm) return
    
    // 移除重複項目並加到最前面
    recentSearches.value = [
      cleanTerm,
      ...recentSearches.value.filter(s => s !== cleanTerm)
    ].slice(0, 10) // 最多保留10個
    
    // 保存到 localStorage
    saveRecentSearches()
  }
  
  /**
   * 清除搜尋結果
   */
  function clearSearchResults() {
    searchResults.value = []
    searchQuery.value = ''
  }
  
  /**
   * 載入最近搜尋記錄
   */
  function loadRecentSearches() {
    try {
      const saved = localStorage.getItem('citeright_recent_searches')
      if (saved) {
        recentSearches.value = JSON.parse(saved)
        console.log('📚 載入最近搜尋記錄:', recentSearches.value.length, '筆')
      }
    } catch (error) {
      console.error('💥 載入最近搜尋記錄失敗:', error)
    }
  }
  
  /**
   * 保存最近搜尋記錄
   */
  function saveRecentSearches() {
    try {
      localStorage.setItem('citeright_recent_searches', JSON.stringify(recentSearches.value))
    } catch (error) {
      console.error('💥 保存最近搜尋記錄失敗:', error)
    }
  }
  
  /**
   * 清除快取
   */
  function clearCache() {
    cachedLaws.value.clear()
    console.log('🧹 已清除法規快取')
  }
  
  /**
   * 重置 store 狀態
   */
  function resetState() {
    searchQuery.value = ''
    searchResults.value = []
    isSearching.value = false
    clearCache()
    console.log('🔄 已重置 Dictionary store 狀態')
  }
  
  // Helper functions
  
  /**
   * 發送訊息給背景腳本
   */
  function sendMessageToBackground(message) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError)
            resolve({ success: false, error: chrome.runtime.lastError.message })
          } else {
            resolve(response)
          }
        })
      } else {
        console.warn('⚠️ Chrome runtime not available, using mock data')
        // 在開發環境或測試環境返回模擬數據
        resolve(generateMockResponse(message))
      }
    })
  }
  
  /**
   * 生成模擬回應（用於開發/測試）
   */
  function generateMockResponse(message) {
    switch (message.action) {
      case 'searchLawDictionary':
        return {
          success: true,
          results: generateMockSearchResults(message.query)
        }
      case 'fetchLawContent':
        return {
          success: true,
          data: generateMockLawContent(message.lawName)
        }
      default:
        return { success: false, error: 'Unknown action' }
    }
  }
  
  /**
   * 生成模擬搜尋結果
   */
  function generateMockSearchResults(query) {
    const mockLaws = ['民法', '刑法', '勞動基準法', '公司法', '民事訴訟法']
    const results = []
    
    const numResults = Math.floor(Math.random() * 3) + 3
    for (let i = 0; i < numResults && i < mockLaws.length; i++) {
      results.push({
        title: `${mockLaws[i]} - ${query}相關條文`,
        lawName: mockLaws[i],
        article: `第${Math.floor(Math.random() * 100) + 1}條`,
        preview: `關於「${query}」的規定：本條文規範${query}相關事項，包含定義、範圍與法律效果...`,
        source: '臺灣法規資料庫'
      })
    }
    
    return results
  }
  
  /**
   * 生成模擬法規內容
   */
  function generateMockLawContent(lawName) {
    return {
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
        }
      ],
      totalArticles: 100,
      officialUrl: `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${lawName}`
    }
  }

  return {
    // State
    searchQuery,
    searchResults,
    recentSearches,
    isSearching,
    lawCategories,
    cachedLaws,
    searchHistory,
    
    // Computed
    hasSearchResults,
    recentSearchesDisplay,
    
    // Actions
    searchLaws,
    fetchLawContent,
    addToRecentSearches,
    clearSearchResults,
    loadRecentSearches,
    saveRecentSearches,
    clearCache,
    resetState
  }
})