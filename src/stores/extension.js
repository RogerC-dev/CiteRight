import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExtensionStore = defineStore('extension', () => {
  // 狀態
  const isExtensionEnabled = ref(true)
  const isActivated = ref(false)
  const isCtrlPressed = ref(false)
  const activationTimeout = ref(null)
  
  // 計算屬性
  const canShowPopover = computed(() => {
    return isExtensionEnabled.value && isActivated.value && isCtrlPressed.value
  })
  
  // 動作
  function initialize() {
    console.log('🔍 法源探測器 (CiteRight) Vue 版本啟動')
    
    // 監聽 Chrome 擴充功能消息
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleChromeMessage)
    }
    
    // 監聽鍵盤事件
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    
    // 從存儲載入狀態
    loadStoredState()
  }
  
  function cleanup() {
    // 清理事件監聽器和計時器
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    clearTimeout(activationTimeout.value)
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(handleChromeMessage)
    }
  }
  
  function handleKeyDown(e) {
    if (e.ctrlKey && !isCtrlPressed.value) {
      isCtrlPressed.value = true
      
      if (!isExtensionEnabled.value) {
        console.log('❌ 擴充功能已停用')
        return
      }
      
      // 自動啟用懸停模式
      if (!isActivated.value) {
        isActivated.value = true
        console.log('⚖️ Ctrl 按下 - 懸停模式已啟用')
      }
      
      // 設定自動停用計時器（3分鐘）
      clearTimeout(activationTimeout.value)
      activationTimeout.value = setTimeout(() => {
        isActivated.value = false
        console.log('⏰ 懸停模式已自動停用 (3分鐘無操作)')
      }, 180000)
    }
  }
  
  function handleKeyUp(e) {
    if (!e.ctrlKey && isCtrlPressed.value) {
      isCtrlPressed.value = false
      console.log('⚖️ Ctrl 釋放')
    }
  }
  
  function handleChromeMessage(message, sender, sendResponse) {
    switch (message.action) {
      case "activateCiteRight":
        activate(message.selectedText)
        sendResponse({ success: true })
        break
        
      case "deactivateCiteRight":
        deactivate()
        sendResponse({ success: true })
        break
        
      case "toggleExtension":
        setEnabled(message.enabled)
        sendResponse({ success: true })
        break
        
      case "getStatus":
        sendResponse({
          activated: isActivated.value,
          enabled: isExtensionEnabled.value
        })
        break
        
      case "setEnabledState":
        setEnabled(!!message.enabled)
        break
        
      case "openBookmarks":
        openBookmarksPanel()
        sendResponse({ success: true })
        break
    }
  }
  
  function activate(selectedText = null) {
    isActivated.value = true
    console.log('⚖️ 透過右鍵選單啟用台灣法源探測器')
    
    // 設定自動停用計時器（5分鐘）
    clearTimeout(activationTimeout.value)
    activationTimeout.value = setTimeout(() => {
      isActivated.value = false
      console.log('⏰ 法源探測器已自動停用 (5分鐘無操作)')
    }, 300000)
  }
  
  function deactivate() {
    isActivated.value = false
    clearTimeout(activationTimeout.value)
    console.log('❌ 透過右鍵選單停用台灣法源探測器')
  }
  
  function setEnabled(enabled) {
    isExtensionEnabled.value = enabled
    
    if (!enabled) {
      // 停用時清理所有狀態
      isActivated.value = false
      clearTimeout(activationTimeout.value)
      console.log('🔴 CiteRight 擴充功能已停用')
    } else {
      console.log('🟢 CiteRight 擴充功能已啟用')
    }
  }
  
  async function loadStoredState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(['citeright_enabled'])
        // 預設為啟用
        isExtensionEnabled.value = result.citeright_enabled !== undefined ? result.citeright_enabled : true
        console.log(isExtensionEnabled.value ? '🟢 CiteRight 擴充功能已啟用' : '🔴 CiteRight 擴充功能已停用')
      } catch (error) {
        console.error('載入擴充功能狀態失敗:', error)
      }
    }
  }
  
  function openBookmarksPanel() {
    console.log('📚 開啟書籤面板 - 來自擴充功能彈出視窗')
    
    // Get the stores - we need to import them dynamically
    import('./sidebar.js').then(({ useSidebarStore }) => {
      const sidebarStore = useSidebarStore()
      
      // Open sidebar and switch to bookmarks tab
      sidebarStore.open()
      sidebarStore.setCurrentTab('bookmarks')
      
      console.log('✅ 書籤面板已開啟')
    }).catch(error => {
      console.error('❌ 開啟書籤面板失敗:', error)
    })
  }
  
  return {
    // 狀態
    isExtensionEnabled,
    isActivated,
    isCtrlPressed,
    
    // 計算屬性
    canShowPopover,
    
    // 動作
    initialize,
    cleanup,
    activate,
    deactivate,
    setEnabled,
    openBookmarksPanel
  }
})