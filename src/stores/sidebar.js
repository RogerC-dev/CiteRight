import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  // 狀態
  const isOpen = ref(false)
  const width = ref(500) // 預設寬度
  const currentTab = ref('tool') // 'tool' | 'bookmarks' | 'dictionary'
  const isFloating = ref(false)
  const isResizing = ref(false)
  
  // 計算屬性
  const sidebarBoundary = computed(() => Math.floor(window.innerWidth / 3))
  const minWidth = computed(() => sidebarBoundary.value)
  const maxWidth = computed(() => window.innerWidth * 0.8)
  
  const shouldFloat = computed(() => width.value > sidebarBoundary.value)
  
  // 動作
  function open() {
    if (!isOpen.value) {
      loadSavedWidth()
      adjustWebContentForSidebar()
      isOpen.value = true
      console.log('✅ 側邊欄已開啟')
    }
  }
  
  function close() {
    if (isOpen.value) {
      isOpen.value = false
      restoreWebContent()
      console.log('✅ 側邊欄已關閉')
    }
  }
  
  function setWidth(newWidth) {
    // 檢查輸入值是否為數字
    if (isNaN(newWidth) || typeof newWidth !== 'number') {
      console.warn('⚠️ 無效的寬度值:', newWidth, '使用預設值')
      newWidth = 500 // 使用預設寬度
    }

    // 限制寬度範圍
    const constrainedWidth = Math.max(minWidth.value, Math.min(newWidth, maxWidth.value))
    width.value = constrainedWidth
    
    // 儲存到 localStorage
    saveWidth(constrainedWidth)
    
    // 更新浮動狀態
    updateFloatingState()
    
    console.log('🔄 側邊欄寬度已更新:', constrainedWidth + 'px')
  }
  
  function setCurrentTab(tab) {
    if (['tool', 'bookmarks', 'dictionary'].includes(tab)) {
      currentTab.value = tab
      console.log('📑 切換到分頁:', tab)
    }
  }
  
  function setResizing(resizing) {
    isResizing.value = resizing
    
    if (resizing) {
      // 開始調整時切換到浮動模式
      isFloating.value = true
      restoreWebContent()
      console.log('🔧 開始調整大小 - 切換到浮動模式')
    } else {
      // 結束調整時根據寬度決定模式
      updateFloatingState()
      if (!isFloating.value) {
        adjustWebContentForSidebar()
      }
      console.log('✅ 調整大小完成')
    }
  }
  
  function updateFloatingState() {
    const shouldFloatNow = shouldFloat.value
    
    if (shouldFloatNow !== isFloating.value) {
      isFloating.value = shouldFloatNow
      
      if (isFloating.value) {
        restoreWebContent()
        console.log('🌊 側邊欄浮動於內容上方')
      } else {
        adjustWebContentForSidebar()
        console.log('📍 側邊欄固定在側邊區域')
      }
    }
  }
  
  function adjustWebContentForSidebar() {
    if (!isFloating.value && isOpen.value) {
      const adjustWidth = Math.min(width.value, sidebarBoundary.value)
      document.body.style.width = `calc(100vw - ${adjustWidth}px)`
      document.body.style.maxWidth = `calc(100vw - ${adjustWidth}px)`
      document.body.style.transition = 'width 0.3s ease'
      console.log('✅ 頁面分割: 左側內容，右側側邊欄')
    }
  }
  
  function restoreWebContent() {
    document.body.style.width = ''
    document.body.style.maxWidth = ''
    document.body.style.transition = ''
    console.log('✅ 恢復全頁面寬度')
  }
  
  function loadSavedWidth() {
    try {
      const savedWidth = localStorage.getItem('citeright-panel-width')
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10)
        if (!isNaN(parsedWidth)) {
          width.value = Math.max(minWidth.value, Math.min(parsedWidth, maxWidth.value))
          console.log('💾 已載入儲存的寬度:', width.value + 'px')
        }
      }
    } catch (error) {
      console.error('載入儲存寬度失敗:', error)
    }
  }
  
  function saveWidth(widthToSave) {
    try {
      localStorage.setItem('citeright-panel-width', widthToSave.toString())
      console.log('💾 寬度已儲存:', widthToSave + 'px')
    } catch (error) {
      console.error('儲存寬度失敗:', error)
    }
  }
  
  return {
    // 狀態
    isOpen,
    width,
    currentTab,
    isFloating,
    isResizing,
    
    // 計算屬性
    sidebarBoundary,
    minWidth,
    maxWidth,
    shouldFloat,
    
    // 動作
    open,
    close,
    setWidth,
    setCurrentTab,
    setResizing,
    updateFloatingState
  }
})