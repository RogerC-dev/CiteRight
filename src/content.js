/**
 * CiteRight 台灣法源探測器 Vue 版本
 * Chrome Extension Content Script 入口點
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './content.css'

// 全域變數，避免重複初始化
let isInitialized = false
let app = null

/**
 * 初始化 Vue 應用到 Chrome Extension 環境
 */
function initializeVueApp() {
  if (isInitialized) {
    console.log('⚠️ CiteRight Vue 應用已經初始化')
    return
  }

  try {
    console.log('🚀 初始化 CiteRight Vue 應用...')

    // 創建容器元素
    const container = document.createElement('div')
    container.id = 'citeright-vue-container'
    container.style.cssText = `
      position: relative;
      z-index: 2147483647;
      pointer-events: none;
    `
    
    // 將容器添加到頁面
    document.body.appendChild(container)

    // 創建 Vue 應用
    app = createApp(App)
    const pinia = createPinia()
    
    app.use(pinia)
    
    // 掛載應用
    app.mount(container)
    
    isInitialized = true
    console.log('✅ CiteRight Vue 應用初始化完成')
    
    // 設定全域引用供調試使用
    if (typeof window !== 'undefined') {
      window.citerightVueApp = app
      window.citerightContainer = container
    }
    
  } catch (error) {
    console.error('❌ CiteRight Vue 應用初始化失敗:', error)
    isInitialized = false
  }
}

/**
 * 清理 Vue 應用
 */
function cleanupVueApp() {
  if (!isInitialized || !app) return
  
  try {
    console.log('🧹 清理 CiteRight Vue 應用...')
    
    // 卸載 Vue 應用
    app.unmount()
    
    // 移除容器
    const container = document.getElementById('citeright-vue-container')
    if (container) {
      container.remove()
    }
    
    // 清理全域引用
    if (typeof window !== 'undefined') {
      delete window.citerightVueApp
      delete window.citerightContainer
    }
    
    app = null
    isInitialized = false
    
    console.log('✅ CiteRight Vue 應用已清理')
  } catch (error) {
    console.error('❌ 清理 CiteRight Vue 應用時發生錯誤:', error)
  }
}

/**
 * 檢查是否應該在當前頁面運行
 */
function shouldRunOnCurrentPage() {
  // 跳過 extension 頁面
  if (window.location.protocol === 'chrome-extension:') {
    return false
  }
  
  // 跳過 about: 和 data: URL
  if (['about:', 'data:', 'blob:'].some(protocol => window.location.href.startsWith(protocol))) {
    return false
  }
  
  // 檢查頁面是否包含可能的法律內容
  const bodyText = document.body ? document.body.textContent || '' : ''
  const hasLegalKeywords = /[字號釋憲判第度年條項款目法]/.test(bodyText)
  
  // 如果頁面很小且沒有法律關鍵字，跳過
  if (bodyText.length < 100 && !hasLegalKeywords) {
    return false
  }
  
  return true
}

/**
 * 等待 DOM 準備就緒
 */
function waitForDOM() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    } else {
      resolve()
    }
  })
}

/**
 * 主要初始化函數
 */
async function main() {
  try {
    // 等待 DOM 準備就緒
    await waitForDOM()
    
    // 檢查是否應該在當前頁面運行
    if (!shouldRunOnCurrentPage()) {
      console.log('⏭️ 跳過當前頁面，不運行 CiteRight')
      return
    }
    
    // 短暫延遲，確保頁面完全載入
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 初始化 Vue 應用
    initializeVueApp()
    
  } catch (error) {
    console.error('❌ CiteRight 初始化過程中發生錯誤:', error)
  }
}

/**
 * 處理頁面卸載
 */
function handlePageUnload() {
  cleanupVueApp()
}

/**
 * 處理擴充功能重新載入
 */
function handleExtensionReload() {
  console.log('🔄 檢測到擴充功能重新載入')
  cleanupVueApp()
  
  // 短暫延遲後重新初始化
  setTimeout(() => {
    if (shouldRunOnCurrentPage()) {
      initializeVueApp()
    }
  }, 1000)
}

// 監聽擴充功能連接中斷（重新載入時會發生）
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onConnect.addListener(() => {
    // 連接建立時的處理
  })
  
  // 監聽運行時錯誤（擴充功能重新載入時會觸發）
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
      sendResponse({ status: 'ok' })
    }
    return true
  })
}

// 監聽頁面卸載
window.addEventListener('beforeunload', handlePageUnload)
window.addEventListener('unload', handlePageUnload)

// 監聽頁面可見性變化
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !isInitialized) {
    // 頁面重新可見時，如果應用未初始化則重新初始化
    if (shouldRunOnCurrentPage()) {
      setTimeout(initializeVueApp, 100)
    }
  }
})

// 為了向後兼容，暴露一些函數到全域
if (typeof window !== 'undefined') {
  window.citerightInit = initializeVueApp
  window.citerightCleanup = cleanupVueApp
  window.citerightReload = handleExtensionReload
}

// 立即執行主函數
main()

// 為了調試，輸出版本信息
console.log('📖 CiteRight 台灣法源探測器 Vue 版本已載入')