/**
 * API 服務模組 - 負責與後端 API 的通訊
 */

const API_BASE_URL = 'http://localhost:3000'

/**
 * 基礎 fetch 包裝器，包含錯誤處理
 * @param {string} url - API 端點
 * @param {Object} options - fetch 選項
 * @returns {Promise} - API 回應
 */
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API 請求錯誤:', error)
    throw error
  }
}

/**
 * 載入法律名稱列表
 * @returns {Promise<Array>} - 法律名稱陣列
 */
export async function loadLegalNames() {
  try {
    const response = await apiRequest(`${API_BASE_URL}/api/laws`)
    return response.data || []
  } catch (error) {
    console.error('載入法律名稱失敗:', error)
    throw new Error('無法載入法律資料，請檢查伺服器是否運行')
  }
}

/**
 * 查詢釋字資料
 * @param {string} number - 釋字號碼
 * @returns {Promise<Object>} - 釋字資料
 */
export async function fetchInterpretation(number) {
  try {
    const params = new URLSearchParams({
      'caseType': '釋字',
      'number': number
    })
    
    const response = await apiRequest(`${API_BASE_URL}/api/case?${params.toString()}`)
    
    return response
  } catch (error) {
    console.error('載入釋字資料失敗:', error)
    throw new Error('無法載入釋字內容')
  }
}

/**
 * 查詢法條資料
 * @param {string} lawName - 法律名稱
 * @param {string} article - 條文號碼
 * @param {string} paragraph - 項款目（可選）
 * @returns {Promise<Object>} - 法條資料
 */
export async function fetchLawArticle(lawName, article, paragraph = '') {
  try {
    // 從後端取得整個法條物件（包含 Articles 陣列）
    const response = await apiRequest(`${API_BASE_URL}/api/laws/${encodeURIComponent(lawName)}`)

    // 後端回傳結構參考: 包含 Articles: [{ CaptionTitle, ArticleNo, Article }]
    const articles = response.Articles || response.articles || []

    // 找到對應的 ArticleNo（後端 ArticleNo 可能含有前綴或空白，做寬鬆比對）
    const target = articles.find(a => {
      if (!a || !a.ArticleNo) return false
      // 移除非數字文字後比對數字或完整相等
      const normalized = a.ArticleNo.replace(/[^0-9一二三四五六七八九十百千零壹貳參肆伍陸柒捌玖拾]/g, '')
      const reqNormalized = String(article).replace(/[^0-9一二三四五六七八九十百千零壹貳參肆伍陸柒捌玖拾]/g, '')
      return a.ArticleNo.trim() === String(article).trim() || normalized === reqNormalized
    })

    let contentText = ''
    let captionTitle = ''

    if (target && target.Article) {
      contentText = target.Article
      captionTitle = target.CaptionTitle || ''

      // 若要求特定項款（paragraph），嘗試解析並擷取相應段落
      if (paragraph) {
        // 常見格式: '第 1 項' 或 '1' 或 '1-2' 等，嘗試建立 regex
        const numMatch = paragraph.match(/(\d+|[一二三四五六七八九十百千零壹貳參肆伍陸柒捌玖拾]+)/)
        if (numMatch) {
          const p = numMatch[0]
          // 建立簡單的項目分段規則：以 '項' 分隔或以換行 + 項號標記
          const parts = contentText.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          // 嘗試在每段中尋找包含 '第 p 項' 或 '（p）' 或 '（第p項）' 的段落
          const found = parts.find(part => new RegExp(`第\\s*${p}\\s*項`).test(part) || new RegExp(`^\\(${p}\\)`).test(part) || new RegExp(`（\\s*${p}\\s*）`).test(part) )
          if (found) {
            contentText = found
          } else {
            // 若無精準段落，嘗試找出第 n 號段（數字序列）
            const numericParts = parts.filter(part => /^\d+\./.test(part) || /^\d+、/.test(part))
            if (numericParts.length > 0) {
              const idx = parseInt(p, 10) - 1
              if (!isNaN(idx) && numericParts[idx]) contentText = numericParts[idx]
            }
          }
        }
      }
    } else {
      contentText = '無法載入條文內容'
    }

    return response
  } catch (error) {
    console.error('載入法條資料失敗:', error)
    throw new Error('無法載入法條內容')
  }
}

/**
 * 查詢法律資訊
 * @param {string} lawName - 法律名稱
 * @returns {Promise<Object>} - 法律資訊
 */
/**
 * 正規化法律名稱，處理不同變體的法律名稱映射
 * @param {string} lawName - 原始法律名稱
 * @returns {string} - 正規化後的法律名稱
 */
function normalizeLawName(lawName) {
  // 法律名稱映射表 - 將不同變體映射到數據庫中的標準名稱
  const lawNameMap = {
    '刑法': '中華民國刑法', // 映射到數據庫中的完整名稱
    '民法': '民法', // 民法保持不變
    '中華民國憲法': '中華民國憲法', // 憲法保持完整名稱
    // 可以繼續添加其他映射
  }

  return lawNameMap[lawName] || lawName
}

export async function fetchLawInfo(lawName) {
  try {
    // 正規化法律名稱
    const normalizedLawName = normalizeLawName(lawName)
    console.log('🔄 正規化法律名稱:', lawName, '->', normalizedLawName)

    const response = await apiRequest(`${API_BASE_URL}/api/laws/${encodeURIComponent(normalizedLawName)}`)

    return response
  } catch (error) {
    console.error('載入法律資訊失敗:', error)
    throw new Error('無法載入法律資訊')
  }
}

/**
 * 查詢判決資料
 * @param {string} year - 年度
 * @param {string} caseType - 案件類型
 * @param {string} number - 案件號碼
 * @returns {Promise<Object>} - 判決資料
 */
export async function fetchJudgment(year, caseType, number) {
  try {
    const params = new URLSearchParams({
      year: year,
      caseType: caseType,
      number: number
    })
    
    const response = await apiRequest(`${API_BASE_URL}/api/judgment?${params.toString()}`)
    
    return {
      title: response.title || `${year}年${caseType}字第${number}號`,
      content: response.content || '無法載入判決內容',
      date: response.date,
      court: response.court,
      rawData: response
    }
  } catch (error) {
    console.error('載入判決資料失敗:', error)
    throw new Error('無法載入判決內容')
  }
}

/**
 * 搜尋法律資料
 * @param {string} query - 搜尋關鍵字
 * @param {Object} options - 搜尋選項
 * @returns {Promise<Array>} - 搜尋結果
 */
export async function searchLegalData(query, options = {}) {
  try {
    // 先嘗試載入法律名稱列表進行模糊搜尋
    const lawNames = await loadLegalNames()

    // 過濾包含關鍵字的法律
    const matchedLaws = lawNames.filter(law =>
      law.LawName && law.LawName.includes(query)
    )

    // 如果找到匹配的法律，為每個法律創建結果
    if (matchedLaws.length > 0) {
      const results = []

      for (const law of matchedLaws.slice(0, 5)) { // 限制最多5個結果
        try {
          // 載入法律內容
          const lawContent = await fetchLawInfo(law.LawName)

          if (lawContent && lawContent.Articles) {
            // 搜尋包含關鍵字的條文
            const matchedArticles = lawContent.Articles.filter(article =>
              article.Article && article.Article.includes(query)
            ).slice(0, 3) // 每個法律最多顯示3條相關條文

            if (matchedArticles.length > 0) {
              // 為每個匹配的條文創建結果
              matchedArticles.forEach(article => {
                results.push({
                  LawName: law.LawName,
                  title: `${law.LawName} ${article.ArticleNo}`,
                  ArticleNo: article.ArticleNo,
                  Article: article.Article,
                  CaptionTitle: article.CaptionTitle,
                  description: `${article.Article.substring(0, 100)}...`,
                  LawUrl: law.LawUrl,
                  lawName: law.LawName,
                  article: article.ArticleNo?.replace(/[^0-9]/g, ''), // 提取數字
                  type: 'law'
                })
              })
            } else {
              // 如果沒找到特定條文，返回整部法律
              results.push({
                LawName: law.LawName,
                title: `${law.LawName} - ${query}相關法規`,
                description: `${law.LawName}中關於「${query}」的相關規定`,
                LawUrl: law.LawUrl,
                lawName: law.LawName,
                type: 'law'
              })
            }
          }
        } catch (lawError) {
          console.warn(`載入法律 ${law.LawName} 失敗:`, lawError)
          // 即使載入失敗，也提供基本資訊
          results.push({
            LawName: law.LawName,
            title: `${law.LawName} - ${query}相關法規`,
            description: `${law.LawName}中關於「${query}」的相關規定`,
            LawUrl: law.LawUrl,
            lawName: law.LawName,
            type: 'law'
          })
        }
      }

      return results
    }

    return []
  } catch (error) {
    console.error('搜尋法律資料失敗:', error)
    throw new Error('搜尋功能暫時無法使用')
  }
}

/**
 * 取得伺服器健康狀態
 * @returns {Promise<Object>} - 伺服器狀態
 */
export async function getServerHealth() {
  try {
    const response = await apiRequest(`${API_BASE_URL}/api/health`)
    return response
  } catch (error) {
    console.error('無法連接到伺服器:', error)
    return { status: 'error', message: '伺服器連接失敗' }
  }
}

/**
 * 檢查 API 是否可用
 * @returns {Promise<boolean>} - API 是否可用
 */
export async function isApiAvailable() {
  try {
    await getServerHealth()
    return true
  } catch (error) {
    return false
  }
}