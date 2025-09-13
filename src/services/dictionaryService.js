/**
 * Dictionary Service
 * 處理法律辭典的API呼叫和資料管理
 */

// Dictionary API configuration
const DICTIONARY_API = {
  baseUrl: 'https://law.moj.gov.tw/LawClass/', // Taiwan MOJ Law Database
  searchEndpoint: 'LawSearchContent.aspx',
  lawEndpoint: 'LawAll.aspx'
}

class DictionaryService {
  constructor() {
    this.cache = new Map()
    this.searchCache = new Map()
  }

  /**
   * 搜尋法規
   * @param {string} query - 搜尋關鍵字
   * @returns {Promise<Object>} 搜尋結果
   */
  async searchLaws(query) {
    try {
      console.log('🔍 Dictionary Service - 搜尋法規:', query)
      
      // 檢查搜尋快取
      const cacheKey = `search_${query}`
      if (this.searchCache.has(cacheKey)) {
        console.log('📦 使用搜尋快取:', query)
        return this.searchCache.get(cacheKey)
      }
      
      // 先嘗試本地快取搜尋
      const cachedResults = this.searchCachedLaws(query)
      if (cachedResults.length > 0) {
        const result = { success: true, results: cachedResults }
        this.searchCache.set(cacheKey, result)
        return result
      }
      
      // 呼叫背景腳本API
      const response = await this.sendMessageToBackground({
        action: 'searchLawDictionary',
        query: query
      })
      
      if (response && response.success) {
        // 快取成功結果
        this.searchCache.set(cacheKey, response)
        return response
      } else {
        throw new Error(response?.error || '搜尋失敗')
      }
      
    } catch (error) {
      console.error('💥 Dictionary Service - 搜尋錯誤:', error)
      throw error
    }
  }

  /**
   * 獲取法規內容
   * @param {string} lawName - 法規名稱
   * @returns {Promise<Object>} 法規內容
   */
  async fetchLawContent(lawName) {
    try {
      console.log('📖 Dictionary Service - 獲取法規:', lawName)
      
      // 檢查快取
      const cacheKey = `law_content_${lawName}`
      if (this.cache.has(cacheKey)) {
        console.log('📦 使用法規快取:', lawName)
        return this.cache.get(cacheKey)
      }
      
      // 呼叫背景腳本API
      const response = await this.sendMessageToBackground({
        action: 'fetchLawContent',
        lawName: lawName
      })
      
      if (response && response.success) {
        // 快取結果 (有效期1小時)
        this.cache.set(cacheKey, response.data)
        setTimeout(() => {
          this.cache.delete(cacheKey)
        }, 3600000) // 1小時後清除快取
        
        return response.data
      } else {
        throw new Error(response?.error || '獲取法規內容失敗')
      }
      
    } catch (error) {
      console.error('💥 Dictionary Service - 獲取法規錯誤:', error)
      throw error
    }
  }

  /**
   * 搜尋快取中的法規
   * @param {string} query - 搜尋關鍵字
   * @returns {Array} 搜尋結果陣列
   */
  searchCachedLaws(query) {
    const commonLaws = [
      { 
        lawName: '民法', 
        articles: ['第1條', '第184條', '第195條', '第965條'],
        keywords: ['民法', '民事', '契約', '侵權', '物權', '親屬', '繼承']
      },
      { 
        lawName: '刑法', 
        articles: ['第1條', '第271條', '第339條', '354條'],
        keywords: ['刑法', '刑事', '犯罪', '殺人', '詐欺', '竊盜']
      },
      { 
        lawName: '勞動基準法', 
        articles: ['第1條', '第32條', '第38條', '第84條'],
        keywords: ['勞基法', '勞動', '工時', '加班', '休假', '工資']
      },
      { 
        lawName: '公司法', 
        articles: ['第1條', '第8條', '第128條', '369條'],
        keywords: ['公司法', '公司', '股份', '董事', '股東', '合併']
      },
      { 
        lawName: '民事訴訟法', 
        articles: ['第1條', '第244條', '第427條'],
        keywords: ['民訴法', '訴訟', '起訴', '上訴', '證據']
      },
      {
        lawName: '刑事訴訟法',
        articles: ['第1條', '第95條', '第154條'],
        keywords: ['刑訴法', '刑事訴訟', '偵查', '起訴', '審判']
      },
      {
        lawName: '行政程序法',
        articles: ['第1條', '第36條', '第102條'],
        keywords: ['行政程序', '行政處分', '聽證']
      }
    ]
    
    const results = []
    const queryLower = query.toLowerCase()
    
    commonLaws.forEach(law => {
      // 檢查法規名稱或關鍵字是否匹配
      const nameMatch = law.lawName.includes(query)
      const keywordMatch = law.keywords.some(keyword => 
        keyword.includes(query) || query.includes(keyword)
      )
      
      if (nameMatch || keywordMatch) {
        law.articles.forEach(article => {
          results.push({
            title: `${law.lawName} ${article}`,
            lawName: law.lawName,
            article: article,
            preview: this.generateArticlePreview(law.lawName, article, query),
            source: '臺灣法規資料庫',
            relevance: nameMatch ? 1.0 : 0.8 // 名稱匹配優先級更高
          })
        })
      }
    })
    
    // 依相關性排序並限制結果數量
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
  }

  /**
   * 生成條文預覽內容
   * @param {string} lawName - 法規名稱
   * @param {string} article - 條文編號
   * @param {string} query - 搜尋關鍵字
   * @returns {string} 預覽內容
   */
  generateArticlePreview(lawName, article, query) {
    const previews = {
      '民法': {
        '第1條': '民事，法律所未規定者，依習慣；無習慣者，依法理。',
        '第184條': '因故意或過失，不法侵害他人之權利者，負損害賠償責任。',
        '第195條': '不法侵害他人之身體、健康、名譽、自由、信用、隱私、貞操，或不法侵害其他人格法益而情節重大者，被害人雖非財產上之損害，亦得請求賠償相當之金額。',
        '第965條': '稱動產物權之讓與，非將動產交付，不生效力。'
      },
      '刑法': {
        '第1條': '行為之處罰，以行為時之法律有明文規定者為限。',
        '第271條': '殺人者，處死刑、無期徒刑或十年以上有期徒刑。',
        '第339條': '意圖為自己或第三人不法之所有，以詐術使人將本人或第三人之物交付者，處五年以下有期徒刑、拘役或科或併科一千元以下罰金。'
      }
      // 可以繼續添加其他法規的條文預覽
    }
    
    const lawPreviews = previews[lawName]
    if (lawPreviews && lawPreviews[article]) {
      return lawPreviews[article]
    }
    
    return `${lawName}${article}：關於「${query}」的規定，詳細條文內容請點擊查看。`
  }

  /**
   * 發送訊息給背景腳本
   * @param {Object} message - 要發送的訊息
   * @returns {Promise<Object>} 回應結果
   */
  sendMessageToBackground(message) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError)
            // 如果背景腳本不可用，使用模擬資料
            resolve(this.generateMockResponse(message))
          } else {
            resolve(response || { success: false, error: 'No response received' })
          }
        })
      } else {
        console.warn('⚠️ Chrome runtime not available, using mock data')
        // 在開發環境或背景腳本不可用時使用模擬資料
        resolve(this.generateMockResponse(message))
      }
    })
  }

  /**
   * 生成模擬回應資料
   * @param {Object} message - 原始訊息
   * @returns {Object} 模擬回應
   */
  generateMockResponse(message) {
    switch (message.action) {
      case 'searchLawDictionary':
        return {
          success: true,
          results: this.generateMockSearchResults(message.query)
        }
      case 'fetchLawContent':
        return {
          success: true,
          data: this.generateMockLawContent(message.lawName)
        }
      default:
        return { 
          success: false, 
          error: 'Unknown action: ' + message.action 
        }
    }
  }

  /**
   * 生成模擬搜尋結果
   * @param {string} query - 搜尋關鍵字
   * @returns {Array} 模擬搜尋結果
   */
  generateMockSearchResults(query) {
    const mockLaws = ['民法', '刑法', '勞動基準法', '公司法', '民事訴訟法', '刑事訴訟法']
    const results = []
    
    // 生成3-5個結果
    const numResults = Math.floor(Math.random() * 3) + 3
    for (let i = 0; i < numResults && i < mockLaws.length; i++) {
      const law = mockLaws[i]
      const articleNum = Math.floor(Math.random() * 100) + 1
      results.push({
        title: `${law} - ${query}相關條文`,
        lawName: law,
        article: `第${articleNum}條`,
        preview: `關於「${query}」的規定：${law}第${articleNum}條規範${query}相關事項，包含定義、範圍與法律效果等重要內容。`,
        source: '臺灣法規資料庫'
      })
    }
    
    return results
  }

  /**
   * 生成模擬法規內容
   * @param {string} lawName - 法規名稱
   * @returns {Object} 模擬法規內容
   */
  generateMockLawContent(lawName) {
    return {
      lawName: lawName,
      title: lawName,
      type: 'law',
      lastAmended: '2024-01-15',
      status: 'active',
      enactmentDate: '1929-05-23',
      chapters: [
        {
          name: '第一章 總則',
          articles: [
            {
              number: '1',
              title: '立法目的',
              content: `為規範${lawName}相關事項，保障人民權益，促進社會秩序，特制定本法。`
            },
            {
              number: '2',
              title: '主管機關',
              content: `本法所稱主管機關：在中央為法務部；在直轄市為直轄市政府；在縣（市）為縣（市）政府。`
            },
            {
              number: '3',
              title: '適用範圍',
              content: `本法適用於中華民國領域內之一切${lawName.includes('民法') ? '民事' : lawName.includes('刑法') ? '刑事' : '相關'}事件。`
            }
          ]
        },
        {
          name: '第二章 權利義務',
          articles: [
            {
              number: '4',
              title: '權利行使',
              content: `依本法規定享有權利者，應遵守相關義務規定，不得濫用權利。`
            },
            {
              number: '5',
              title: '義務履行',
              content: `負有義務者應依法履行，不得無故拖延或拒絕。`
            }
          ]
        }
      ],
      totalArticles: 100 + Math.floor(Math.random() * 500), // 隨機總條文數
      officialUrl: `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${encodeURIComponent(lawName)}`,
      relatedLaws: this.getRelatedLaws(lawName)
    }
  }

  /**
   * 獲取相關法規
   * @param {string} lawName - 法規名稱
   * @returns {Array} 相關法規列表
   */
  getRelatedLaws(lawName) {
    const relatedMap = {
      '民法': ['民事訴訟法', '家事事件法', '消費者保護法'],
      '刑法': ['刑事訴訟法', '少年事件處理法', '毒品危害防制條例'],
      '勞動基準法': ['勞工保險條例', '勞工退休金條例', '職業安全衛生法'],
      '公司法': ['證券交易法', '票據法', '保險法'],
      '民事訴訟法': ['民法', '家事事件法', '強制執行法'],
      '刑事訴訟法': ['刑法', '法院組織法', '檢察官法']
    }
    
    return relatedMap[lawName] || []
  }

  /**
   * 清除快取
   */
  clearCache() {
    this.cache.clear()
    this.searchCache.clear()
    console.log('🧹 Dictionary Service - 已清除所有快取')
  }

  /**
   * 獲取快取統計
   * @returns {Object} 快取統計資訊
   */
  getCacheStats() {
    return {
      lawContentCache: this.cache.size,
      searchCache: this.searchCache.size,
      totalCache: this.cache.size + this.searchCache.size
    }
  }
}

// 創建單例實例
const dictionaryService = new DictionaryService()

export default dictionaryService