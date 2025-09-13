/**
 * 高亮處理 Composable - 負責法條高亮顯示邏輯
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useExtensionStore } from '../stores/extension.js'
import { usePopoverStore } from '../stores/popover.js'
import { TaiwanLegalPatterns, findStandardLawName } from '../services/regexService.js'
import { 
  chineseToArabic, 
  toHalfWidthDigits, 
  escapeHtml, 
  containsLegalKeywords,
  generateLawIdentifier 
} from '../services/textProcessor.js'

export function useHighlight() {
  // Stores
  const extensionStore = useExtensionStore()
  const popoverStore = usePopoverStore()
  
  // 狀態
  const isHighlighting = ref(false)
  const globalSeenNodes = new WeakSet()
  const legalPatterns = new TaiwanLegalPatterns()
  const legalNames = ref([])
  const lastLawName = ref('')
  
  // 計時器
  let highlightTimeout = null
  let observer = null
  
  // 計算屬性
  const shouldHighlight = computed(() => {
    return extensionStore.isExtensionEnabled && !isHighlighting.value
  })
  
  /**
   * 初始化高亮功能
   */
  function initialize(lawNames = []) {
    console.log('🔍 初始化高亮處理模組')
    
    legalNames.value = lawNames
    if (lawNames.length > 0) {
      legalPatterns.generateDynamicPatterns(lawNames)
    }
    
    setupMutationObserver()
    
    // 監聽擴充功能狀態變化
    watch(() => extensionStore.isExtensionEnabled, (enabled) => {
      if (enabled) {
        // 延遲執行高亮以確保 DOM 準備就緒
        setTimeout(() => highlightCitations(), 100)
      } else {
        removeAllHighlights()
      }
    })
  }
  
  /**
   * 清理高亮功能
   */
  function cleanup() {
    clearTimeout(highlightTimeout)
    if (observer) {
      observer.disconnect()
      observer = null
    }
    removeAllHighlights()
    console.log('🧹 高亮處理模組已清理')
  }
  
  /**
   * 設定 MutationObserver 監聽 DOM 變化
   */
  function setupMutationObserver() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', setupMutationObserver)
      return
    }
    
    observer = new MutationObserver(mutations => {
      if (!shouldHighlight.value) return
      
      let shouldProcess = false
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            // 跳過我們自己的高亮 span
            if (node.nodeType === 1 && node.classList && node.classList.contains('citeright-link')) {
              continue
            }
            
            // 跳過在高亮 span 內的節點
            if (node.nodeType === 1 && node.closest && node.closest('.citeright-link')) {
              continue
            }
            
            // 處理文字節點或包含文字的元素
            if (node.nodeType === Node.TEXT_NODE ||
                (node.nodeType === 1 && node.innerText && !node.classList.contains('citeright-link'))) {
              shouldProcess = true
              break
            }
          }
          if (shouldProcess) break
        } else if (mutation.type === 'characterData') {
          // 跳過高亮 span 內的文字變化
          if (mutation.target.parentNode && mutation.target.parentNode.closest &&
              mutation.target.parentNode.closest('.citeright-link')) {
            continue
          }
          shouldProcess = true
          break
        }
      }
      
      if (shouldProcess) {
        console.log('🔍 DOM 變化，排程高亮處理...')
        safeHighlight()
      }
    })
    
    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })
      console.log('🔁 MutationObserver 已啟動')
    } catch (error) {
      console.warn('Observer 啟動失敗:', error.message)
    }
  }
  
  /**
   * 安全的高亮處理，包含防抖和防重入
   */
  function safeHighlight() {
    if (!shouldHighlight.value) {
      console.log('❌ 高亮功能已停用，跳過處理')
      return
    }
    
    if (isHighlighting.value) {
      console.log('🚫 已在處理高亮，跳過...')
      return
    }
    
    // 清除待處理的計時器
    clearTimeout(highlightTimeout)
    
    // 防抖處理，150ms 後執行
    highlightTimeout = setTimeout(() => {
      try {
        isHighlighting.value = true
        console.log('🔄 開始高亮處理...')
        highlightCitations()
      } catch (error) {
        console.error('高亮處理錯誤:', error)
      } finally {
        isHighlighting.value = false
      }
    }, 150)
  }
  
  /**
   * 主要的高亮處理函數
   */
  function highlightCitations() {
    if (!shouldHighlight.value) {
      console.log('❌ 擴充功能已停用，跳過高亮處理')
      return 0
    }
    
    console.log('🔍 開始全頁面法條高亮')
    return highlightCitationsInElement(document.body)
  }
  
  /**
   * 在特定元素內進行高亮處理
   */
  function highlightCitationsInElement(element) {
    if (!shouldHighlight.value) {
      console.log('❌ 擴充功能已停用，跳過元素高亮處理')
      return 0
    }
    
    console.log('🔍 應用高亮到元素:', element)
    
    let created = 0
    const patterns = legalPatterns.getPatterns()
    const processingOrder = legalPatterns.getProcessingOrder()
    
    // 創建文字節點遍歷器，只處理包含法律關鍵字的文字
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !containsLegalKeywords(node.textContent)) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })
    
    // 收集所有要處理的文字節點
    const textNodes = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode)
    }
    
    // 處理每個文字節點
    textNodes.forEach(node => {
      if (processTextNode(node, patterns, processingOrder)) {
        created++
      }
    })
    
    console.log(`✨ 完成高亮處理，共處理 ${created} 個法律引用`)
    return created
  }
  
  /**
   * 處理單個文字節點
   */
  function processTextNode(node, patterns, processingOrder) {
    if (globalSeenNodes.has(node)) return false
    if (!node.parentNode) return false
    
    // 跳過不適合的父元素
    const parentTag = node.parentNode.tagName
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parentTag)) return false
    if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return false
    
    // 跳過特定面板的標題區域
    if (shouldSkipElement(node)) return false
    
    const originalText = node.textContent
    if (!originalText || !originalText.trim()) return false
    
    const normalizedText = originalText
    
    // 尋找所有潛在匹配
    const allMatches = findAllMatches(normalizedText, patterns, processingOrder)
    
    // 移除重疊匹配
    const filteredMatches = removeOverlappingMatches(allMatches)
    
    if (filteredMatches.length === 0) return false
    
    // 應用高亮
    const success = applyLayeredHighlights(node, filteredMatches, normalizedText)
    if (success) {
      globalSeenNodes.add(node)
    }
    
    return success
  }
  
  /**
   * 檢查是否應該跳過此元素
   */
  function shouldSkipElement(node) {
    if (!node.parentNode.closest) return false
    
    // 跳過書籤面板
    if (node.parentNode.closest('#citeright-bookmarks-panel')) return false
    
    // 跳過彈出視窗標題
    if (node.parentNode.closest('.citeright-header')) return false
    
    // 跳過側邊面板的標題區域
    const sidePanel = node.parentNode.closest('#citeright-tool-panel')
    if (sidePanel) {
      const isInToolContent = node.parentNode.closest('#tool-content') || 
                            node.parentNode.closest('#tool-main-content') ||
                            node.parentNode.closest('.tab-content-inner')
      if (!isInToolContent) return true
      
      // 跳過已存在的法條標題
      if (node.parentNode.closest('span.citeright-link') || 
          node.parentNode.closest('.bookmark-item [style*="font-weight: 600"]') ||
          node.parentNode.closest('[style*="color: #1890ff"]')) {
        return true
      }
      
      // 只高亮 div 內的內容
      if (!node.parentNode.closest('div')) return true
      
      // 跳過標題/標頭元素
      const parentElement = node.parentNode
      if (parentElement && parentElement.style && 
          (parentElement.style.fontWeight === '600' || 
           parentElement.style.color === 'rgb(24, 144, 255)' ||
           parentElement.classList.contains('bookmark-title'))) {
        return true
      }
    }
    
    // 跳過藍色背景的標題列
    if (node.parentNode.closest('[style*="background: linear-gradient(135deg, #1890ff"]')) {
      return true
    }
    
    return false
  }
  
  /**
   * 在文字中尋找所有匹配
   */
  function findAllMatches(text, patterns, processingOrder) {
    const allMatches = []
    
    for (const key of processingOrder) {
      const pattern = patterns[key]
      if (!pattern) continue
      
      let actualPattern = new RegExp(pattern.source, pattern.flags)
      let match
      
      while ((match = actualPattern.exec(text)) !== null) {
        const matchText = match[0]
        
        allMatches.push({
          text: matchText,
          start: match.index,
          end: match.index + matchText.length,
          key: key,
          groups: Array.from(match).slice(1)
        })
        
        // 防止無限迴圈
        if (!actualPattern.global) break
      }
    }
    
    return allMatches
  }
  
  /**
   * 移除重疊的匹配，保留較長/更具體的匹配
   */
  function removeOverlappingMatches(matches) {
    if (matches.length === 0) return matches
    
    console.log(`🔍 處理 ${matches.length} 個匹配的重疊移除`)
    
    // 按位置排序，然後按長度排序（同位置時較長的優先）
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return b.text.length - a.text.length
    })
    
    const result = []
    
    for (const match of matches) {
      let hasOverlap = false
      
      // 檢查與已接受的匹配是否重疊
      for (const accepted of result) {
        if (match.start < accepted.end && match.end > accepted.start) {
          console.log(`🚫 拒絕重疊匹配: "${match.text}" (${match.start}-${match.end}) 與 "${accepted.text}" (${accepted.start}-${accepted.end}) 重疊`)
          hasOverlap = true
          break
        }
      }
      
      if (!hasOverlap) {
        result.push(match)
        console.log(`✅ 接受匹配: "${match.text}" (${match.key}, ${match.start}-${match.end})`)
      }
    }
    
    console.log(`📊 最終結果: ${matches.length} → ${result.length} 個匹配`)
    return result
  }
  
  /**
   * 應用分層高亮，處理重疊問題
   */
  function applyLayeredHighlights(node, matches, normalizedText) {
    if (matches.length === 0) return false
    
    // 按位置排序，較長的優先
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start
      return (b.end - b.start) - (a.end - a.start)
    })
    
    // 移除完全重複的匹配
    const uniqueMatches = []
    const seen = new Set()
    
    for (const match of matches) {
      const key = `${match.start}_${match.end}_${match.text}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueMatches.push(match)
      }
    }
    
    // 構建新的 HTML
    let newHTML = ''
    let lastIndex = 0
    let changed = false
    
    for (const match of uniqueMatches) {
      // 跳過與已處理文字重疊的匹配
      if (match.start < lastIndex) {
        continue
      }
      
      // 添加匹配前的文字
      newHTML += normalizedText.substring(lastIndex, match.start)
      
      // 添加高亮 span
      const highlighted = makeSpan(match.text, match.key, match.groups)
      newHTML += highlighted
      
      // 更新位置
      lastIndex = match.end
      changed = true
    }
    
    // 添加剩餘文字
    newHTML += normalizedText.substring(lastIndex)
    
    // 如果有變化，替換節點內容
    if (changed && newHTML !== normalizedText) {
      const wrapper = document.createElement('span')
      wrapper.innerHTML = newHTML
      
      while (wrapper.firstChild) {
        node.parentNode.insertBefore(wrapper.firstChild, node)
      }
      node.parentNode.removeChild(node)
      
      return true
    }
    
    return false
  }
  
  /**
   * 創建高亮標記的 HTML span 元素
   */
  function makeSpan(match, key, groups) {
    let year = '', caseType = '', number = '', lawName = '', article = '', paragraph = ''
    
    if (key === 'interpretation') {
      caseType = '釋字'
      number = chineseToArabic(toHalfWidthDigits(groups[0]))
    } else if (key === 'law_name_only') {
      const inputLawName = groups[0]
      lawName = findStandardLawName(inputLawName, legalNames.value)
      lastLawName.value = lawName
      caseType = '法律'
      article = ''
      paragraph = ''
    } else if (key === 'dynamic_law_articles') {
      const inputLawName = groups[0]
      lawName = findStandardLawName(inputLawName, legalNames.value)
      lastLawName.value = lawName
      article = chineseToArabic(toHalfWidthDigits(groups[1]))
      
      // 構建項款目
      let paragraphParts = []
      if (groups[2]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[2])))
      if (groups[3]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[3])))
      if (groups[4]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[4])))
      paragraph = paragraphParts.length > 0 ? '-' + paragraphParts.join('-') : ''
      caseType = '法條'
    } else if (key === 'simple_law_articles') {
      const inputLawName = groups[0]
      lawName = findStandardLawName(inputLawName, legalNames.value)
      lastLawName.value = lawName
      article = chineseToArabic(toHalfWidthDigits(groups[1]))
      paragraph = ''
      caseType = '法條'
    } else if (key === 'subarticle_pattern') {
      lawName = lastLawName.value || ''
      const mainArticle = chineseToArabic(toHalfWidthDigits(groups[0]))
      const subArticle = chineseToArabic(toHalfWidthDigits(groups[1]))
      article = `${mainArticle}-${subArticle}`
      
      let paragraphParts = []
      if (groups[2]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[2])))
      if (groups[3]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[3])))
      if (groups[4]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[4])))
      paragraph = paragraphParts.length > 0 ? '-' + paragraphParts.join('-') : ''
      caseType = '法條'
    } else if (key === 'universal_legal_pattern') {
      lawName = lastLawName.value || ''
      
      if (groups[0]) {
        article = chineseToArabic(toHalfWidthDigits(groups[0]))
        let paragraphParts = []
        if (groups[1]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[1])))
        if (groups[2]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[2])))
        if (groups[3]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[3])))
        paragraph = paragraphParts.length > 0 ? '-' + paragraphParts.join('-') : ''
      } else if (groups[4] && groups[5]) {
        article = ''
        const subsectionNum = chineseToArabic(toHalfWidthDigits(groups[4]))
        paragraph = `-${subsectionNum}`
      }
      caseType = '法條'
    }
    
    const result = `<span class="citeright-link" 
              data-year="${escapeHtml(year)}" 
              data-case-type="${escapeHtml(caseType)}" 
              data-number="${escapeHtml(number)}"
              data-law-name="${escapeHtml(lawName)}"
              data-article="${escapeHtml(article)}"
              data-paragraph="${escapeHtml(paragraph)}"
              data-legal-type="${escapeHtml(key)}"
              style="background-color: rgba(24, 144, 255, 0.08) !important; border-bottom: 1px solid rgba(24, 144, 255, 0.3) !important; padding: 1px 2px !important; border-radius: 2px !important; cursor: pointer !important;"
              title="按住 Ctrl 並懸停查看詳情">${escapeHtml(match)}</span>`
    
    return result
  }
  
  /**
   * 移除所有高亮標記
   */
  function removeAllHighlights() {
    console.log('🧹 移除所有高亮標記')
    
    const allHighlights = document.querySelectorAll('.citeright-link')
    let removedCount = 0
    
    allHighlights.forEach(highlight => {
      const parent = highlight.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight)
        removedCount++
      }
    })
    
    // 正規化相鄰的文字節點
    if (removedCount > 0) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      )
      
      const textNodes = []
      let node
      while (node = walker.nextNode()) {
        textNodes.push(node)
      }
      
      textNodes.forEach(textNode => {
        if (textNode.parentNode) {
          textNode.parentNode.normalize()
        }
      })
    }
    
    console.log(`✅ 已移除 ${removedCount} 個高亮標記`)
    return removedCount
  }
  
  return {
    // 狀態
    isHighlighting,
    legalNames,
    
    // 方法
    initialize,
    cleanup,
    highlightCitations,
    highlightCitationsInElement,
    removeAllHighlights,
    safeHighlight
  }
}