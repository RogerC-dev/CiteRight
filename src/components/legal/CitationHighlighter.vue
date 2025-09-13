<template>
  <!-- 無 UI，純邏輯組件 -->
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useHighlight } from '../../composables/useHighlight.js'
import { useExtensionStore } from '../../stores/extension.js'
import { usePopoverStore } from '../../stores/popover.js'
import { loadLegalNames } from '../../services/apiService.js'

// Props
const props = defineProps({
  enabled: {
    type: Boolean,
    default: true
  }
})

// Stores
const extensionStore = useExtensionStore()
const popoverStore = usePopoverStore()

// 使用高亮功能
const { 
  initialize, 
  cleanup, 
  highlightCitations,
  isHighlighting,
  legalNames 
} = useHighlight()

// 事件處理
let currentHoveredLaw = null

/**
 * 處理滑鼠懸停事件
 */
function handleMouseOver(e) {
  if (e.target.classList && e.target.classList.contains('citeright-link')) {
    currentHoveredLaw = e.target
    
    // 檢查是否按下 Ctrl 鍵和擴充功能是否啟用
    if (extensionStore.isCtrlPressed && extensionStore.isExtensionEnabled) {
      // 如果還未激活，先激活
      if (!extensionStore.isActivated) {
        extensionStore.activate()
      }
      
      const lawKey = generateLawKey(e.target)
      
      // 防止重複彈出相同法條
      if (!popoverStore.isVisible || popoverStore.currentElement !== e.target) {
        // 立即顯示，無需延遲
        popoverStore.show(e.target, e)
      }
    }
  }
}

/**
 * 處理滑鼠離開事件
 */
function handleMouseOut(e) {
  if (e.target.classList && e.target.classList.contains('citeright-link')) {
    currentHoveredLaw = null
    // 彈出視窗不會自動隱藏，只能透過點擊 X 或外部關閉
  }
}

/**
 * 處理點擊外部事件
 */
function handleClickOutside(e) {
  // 檢查點擊是否在彈出視窗外且不是法條連結
  if (popoverStore.isVisible &&
      !e.target.closest('#citeright-popover') &&
      !e.target.classList.contains('citeright-link')) {
    popoverStore.hide()
    console.log('❌ 彈出視窗已關閉 (點擊外部)')
  }
}

/**
 * 生成法條唯一鍵值
 */
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

/**
 * 初始化法律資料
 */
async function initializeLegalData() {
  try {
    console.log('🔍 載入法律資料...')
    const lawNames = await loadLegalNames()
    
    // 初始化高亮功能
    initialize(lawNames)
    
    console.log('✅ 法律資料載入完成，共', lawNames.length, '個法律名稱')
    
    // 首次執行高亮（如果擴充功能已啟用）
    if (extensionStore.isExtensionEnabled) {
      setTimeout(() => {
        highlightCitations()
      }, 100)
    }
  } catch (error) {
    console.error('載入法律資料失敗:', error)
    
    // 即使載入失敗也要初始化基本功能
    initialize([])
    
    // 只有在擴充功能啟用時才顯示警告
    if (extensionStore.isExtensionEnabled) {
      alert('載入法律資料失敗，請檢查伺服器是否運行。')
    }
  }
}

// 生命週期
onMounted(() => {
  console.log('📋 CitationHighlighter 組件已掛載')
  
  // 添加事件監聽器
  document.addEventListener('mouseover', handleMouseOver)
  document.addEventListener('mouseout', handleMouseOut)
  document.addEventListener('click', handleClickOutside)
  
  // 初始化法律資料
  initializeLegalData()
})

onUnmounted(() => {
  console.log('📋 CitationHighlighter 組件即將卸載')
  
  // 移除事件監聽器
  document.removeEventListener('mouseover', handleMouseOver)
  document.removeEventListener('mouseout', handleMouseOut)
  document.removeEventListener('click', handleClickOutside)
  
  // 清理高亮功能
  cleanup()
})

// 監聽 enabled 屬性變化
watch(() => props.enabled, (enabled) => {
  console.log('📋 CitationHighlighter enabled 狀態變更:', enabled)
  if (enabled && extensionStore.isExtensionEnabled) {
    setTimeout(() => highlightCitations(), 100)
  }
})

// 暴露方法給父組件（如果需要）
defineExpose({
  highlightCitations,
  isHighlighting,
  legalNames
})
</script>

<style scoped>
/* 純邏輯組件，無樣式 */
</style>