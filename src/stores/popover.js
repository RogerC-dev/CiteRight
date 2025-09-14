import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePopoverStore = defineStore('popover', () => {
  // 狀態
  const isVisible = ref(false)
  const isLoading = ref(false)
  const position = ref({ x: 0, y: 0 })
  const currentData = ref(null)
  const currentElement = ref(null)
  
  // 計時器和狀態管理
  const showTimeout = ref(null)
  const hideTimeout = ref(null)
  const activePopupLaw = ref(null)
  const popupCooldown = ref(false)
  
  // 計算屬性
  const hasData = computed(() => currentData.value !== null)
  
  // 動作
  function show(element, event, data = null) {
    if (popupCooldown.value) return
    
    // 清除任何待處理的隱藏操作
    clearTimeout(hideTimeout.value)
    clearTimeout(showTimeout.value)
    
    // 防止重複彈出相同法條
    const lawKey = generateLawKey(element)
    if (activePopupLaw.value === lawKey && isVisible.value) {
      return
    }
    
    activePopupLaw.value = lawKey
    currentElement.value = element
    
    // 計算位置（使用 viewport 座標，不要混用 scrollX/scrollY）
    const rect = element.getBoundingClientRect()
    // 使用 rect.*（相對於 viewport）配合 fixed 定位
    let left = rect.left
    let top = rect.bottom + 5

    // 預設彈窗大小（與 UI 元件的 max-width / width 保持一致）
    const popoverWidth = 480
    const popoverHeight = 300

    // 檢查是否有側邊欄開啟，調整可用空間
    const sidebarElement = document.getElementById('citeright-tool-panel')
    let availableWidth = window.innerWidth
    
    if (sidebarElement) {
      const sidebarRect = sidebarElement.getBoundingClientRect()
      const sidebarWidth = sidebarRect.width
      
      // 如果側邊欄在右側，減少可用寬度
      if (sidebarRect.left < window.innerWidth) {
        availableWidth = Math.max(400, window.innerWidth - sidebarWidth - 20)
      }
    }

    // 檢查水平空間，若超出可用範圍，向左調整
    if (left + popoverWidth > availableWidth) {
      left = Math.max(10, availableWidth - popoverWidth - 10)
    }
    if (left < 10) left = 10

    // 檢查垂直空間，若超出 viewport 底部則改為顯示在元素上方
    if (top + popoverHeight > window.innerHeight) {
      top = rect.top - popoverHeight - 5
      // 若仍然超出（極高彈窗或靠近頁面頂端），則至少保持在 10px
      if (top < 10) top = 10
    }

    // position 用於 fixed 定位，應該是 viewport 相對座標（不包含 scrollY）
    position.value = { x: left, y: top }
    
    // 設定資料或從元素提取
    if (data) {
      currentData.value = data
    } else {
      currentData.value = extractDataFromElement(element)
    }

    // 如果是法律類型，自動載入法律內容
    if (currentData.value && (currentData.value.caseType === '法律' || currentData.value.lawName)) {
      // 延遲載入法律內容，確保UI已更新
      setTimeout(async () => {
        await loadContent('law', currentData.value)
      }, 150)
    }
    // 如果是釋字類型，自動載入釋字內容
    else if (currentData.value && currentData.value.caseType === '釋字') {
      setTimeout(async () => {
        await loadContent('interpretation', currentData.value)
      }, 150)
    }
    
    // 小延遲後顯示，防止快速觸發
    showTimeout.value = setTimeout(() => {
      isVisible.value = true
      console.log('✅ 彈出視窗已顯示')
    }, 100)
  }
  
  function hide() {
    clearTimeout(showTimeout.value)
    clearTimeout(hideTimeout.value)
    
    isVisible.value = false
    activePopupLaw.value = null
    currentElement.value = null
    
    // 短暫冷卻期防止立即重新顯示
    popupCooldown.value = true
    setTimeout(() => {
      popupCooldown.value = false
    }, 200)
    
    console.log('❌ 彈出視窗已關閉')
  }
  
  function setLoading(loading) {
    isLoading.value = loading
  }
  
  function updateData(data) {
    currentData.value = data
  }
  
  async function loadContent(type, data) {
    console.log('📝 載入內容到工具分頁:', data.title)

    // 針對不同類型的內容進行特殊處理
    let processedData = { ...data }

    // 處理釋字解釋內容
    if (type === 'interpretation' || data.caseType === '釋字' || data.type === '釋字') {
      processedData = {
        ...data,
        type: 'interpretation',
        content: extractInterpretationContent(data),
        number: data.number || extractNumberFromTitle(data.title),
        title: data.title || `釋字第${data.number || ''}號`
      }
    }
    // 處理法律內容
    else if (type === 'law' || data.caseType === '法律' || data.type === '法律' || data.lawName) {
      try {
        const lawContent = await fetchLawContentFromAPI(data.lawName || data.title)
        if (lawContent) {
          processedData = {
            ...data,
            type: 'law',
            content: formatLawContent(lawContent),
            lawName: lawContent.lawName || data.lawName || data.title,
            title: lawContent.title || data.title,
            officialUrl: lawContent.officialUrl,
            lastAmended: lawContent.lastAmended
          }
        }
      } catch (error) {
        console.warn('載入法律內容失敗:', error)
        // 使用原有數據
        processedData = {
          ...data,
          type: 'law',
          content: `<div class="error-message">無法載入法律內容：${error.message}<br><br>可能原因：<ul><li>伺服器未運行或無法連接</li><li>法律名稱不存在</li><li>網路連接問題</li></ul></div>`
        }
      }
    }

    // 更新當前資料，讓 ToolContent 組件可以顯示
    currentData.value = {
      ...processedData,
      type: type,
      dateAdded: data.dateAdded || new Date().toISOString()
    }

    // 觸發 ToolContent 組件的內容載入
    // 這會通過響應式系統自動更新 UI
  }

  async function fetchLawContentFromAPI(lawName) {
    // 動態導入 API 服務
    const { fetchLawInfo } = await import('../services/apiService.js')
    const lawData = await fetchLawInfo(lawName)

    if (lawData && lawData.Articles) {
      return {
        lawName: lawData.LawName || lawName,
        title: lawData.LawName || lawName,
        officialUrl: lawData.LawUrl,
        lastAmended: lawData.LawModifiedDate,
        articles: lawData.Articles
      }
    }

    return null
  }

  function formatLawContent(lawContent) {
    if (!lawContent.articles || lawContent.articles.length === 0) {
      return '<div class="law-content">此法規暫無條文內容</div>'
    }

    const sections = []

    // 添加法規標題
    sections.push(`<div class="law-header">
      <h3>${lawContent.title}</h3>
      ${lawContent.lastAmended ? `<p class="last-amended">最後修訂：${new Date(lawContent.lastAmended).toLocaleDateString('zh-TW')}</p>` : ''}
    </div>`)

    // 添加條文內容
    lawContent.articles.forEach(article => {
      if (article.Article) {
        sections.push(`<div class="law-article">
          <div class="article-number">${article.ArticleNo || ''}</div>
          ${article.CaptionTitle ? `<div class="article-caption">${article.CaptionTitle}</div>` : ''}
          <div class="article-content">${article.Article}</div>
        </div>`)
      }
    })

    return sections.join('')
  }

  function extractInterpretationContent(data) {
    // 提取釋字解釋的主要內容
    let content = data.content || data.fullContent || ''

    // 如果沒有內容，嘗試從其他欄位組合
    if (!content || content === '無內容可顯示') {
      const parts = []

      if (data.issue) {
        parts.push(`<div class="interpretation-section"><h4>爭點</h4><p>${data.issue}</p></div>`)
      }

      if (data.description) {
        parts.push(`<div class="interpretation-section"><h4>解釋文</h4><p>${data.description}</p></div>`)
      }

      if (data.reasoning) {
        parts.push(`<div class="interpretation-section"><h4>理由書</h4><p>${data.reasoning}</p></div>`)
      }

      if (data.chinese && data.chinese.description) {
        parts.push(`<div class="interpretation-section"><h4>解釋內容</h4><p>${data.chinese.description}</p></div>`)
      }

      if (data.chinese && data.chinese.issue) {
        parts.push(`<div class="interpretation-section"><h4>爭議問題</h4><p>${data.chinese.issue}</p></div>`)
      }

      if (data.chinese && data.chinese.reasoning) {
        parts.push(`<div class="interpretation-section"><h4>解釋理由</h4><p>${data.chinese.reasoning}</p></div>`)
      }

      content = parts.length > 0 ? parts.join('') : '無法取得解釋內容'
    }

    return content
  }

  function extractNumberFromTitle(title) {
    if (!title) return ''
    const match = title.match(/第?(\d+)號/)
    return match ? match[1] : ''
  }
  
  function generateLawKey(element) {
    const dataset = element.dataset
    const { lawName, article, paragraph, caseType, number } = dataset
    
    if (caseType === '釋字') {
      return `釋字第${number}號`
    } else if (lawName && article) {
      return `${lawName}第${article}條${paragraph ? `第${paragraph}項` : ''}`
    } else {
      return element.textContent || 'unknown'
    }
  }
  
  function extractDataFromElement(element) {
    const dataset = element.dataset
    
    return {
      id: `law_${Date.now()}`,
      title: generateTitle(dataset),
      type: dataset.caseType || '法律資訊',
      lawName: dataset.lawName || '',
      article: dataset.article || '',
      paragraph: dataset.paragraph || '',
      year: dataset.year || '',
      number: dataset.number || '',
      caseType: dataset.caseType || '',
      legalType: dataset.legalType || '',
      text: element.textContent,
      content: '',
      fullContent: ''
    }
  }
  
  function generateTitle(dataset) {
    const { caseType, number, lawName, article, paragraph } = dataset
    
    if (caseType === '釋字') {
      return `釋字第 ${number} 號`
    } else if (caseType === '法條' && lawName && article) {
      return `${lawName} 第 ${article} 條${paragraph ? ` ${paragraph.replace('-', ' 第')} 項` : ''}`
    } else if (caseType === '法律' && lawName) {
      return lawName
    } else {
      return '台灣法源資訊'
    }
  }
  
  return {
    // 狀態
    isVisible,
    isLoading,
    position,
    currentData,
    currentElement,
    
    // 計算屬性
    hasData,
    
    // 動作
    show,
    hide,
    setLoading,
    updateData,
    loadContent,
    extractDataFromElement
  }
})