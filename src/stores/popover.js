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

    // 檢查水平空間，若超出 viewport，向左調整
    if (left + popoverWidth > window.innerWidth) {
      left = Math.max(10, window.innerWidth - popoverWidth - 10)
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
    extractDataFromElement
  }
})