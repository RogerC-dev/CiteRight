<template>
  <div id="citeright-app">
    <!-- 法律彈出視窗組件 -->
    <LegalPopover 
      v-if="extensionStore.isExtensionEnabled" 
      :show="popoverStore.isVisible"
      :position="popoverStore.position"
      :loading="popoverStore.isLoading"
      :data="popoverStore.currentData"
      @close="popoverStore.hide"
      @bookmark="bookmarkStore.addBookmark"
      @expand="sidebarStore.open"
    />
    
    <!-- 主側邊欄組件 -->
    <MainSidebar 
      v-if="extensionStore.isExtensionEnabled && sidebarStore.isOpen"
      :width="sidebarStore.width"
      :current-tab="sidebarStore.currentTab"
      @close="sidebarStore.close"
      @resize="sidebarStore.setWidth"
      @tab-change="sidebarStore.setCurrentTab"
    />
    
    <!-- 通知組件 -->
    <NotificationManager />
    
    <!-- 高亮處理組件（無 UI，純邏輯） -->
    <CitationHighlighter 
      v-if="extensionStore.isExtensionEnabled"
      :enabled="extensionStore.isActivated"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import LegalPopover from './components/ui/LegalPopover.vue'
import MainSidebar from './components/ui/MainSidebar.vue'
import NotificationManager from './components/ui/NotificationManager.vue'
import CitationHighlighter from './components/legal/CitationHighlighter.vue'
import { useExtensionStore } from './stores/extension'
import { usePopoverStore } from './stores/popover'
import { useSidebarStore } from './stores/sidebar'
import { useBookmarkStore } from './stores/bookmark'

// 使用 stores
const extensionStore = useExtensionStore()
const popoverStore = usePopoverStore()
const sidebarStore = useSidebarStore()
const bookmarkStore = useBookmarkStore()

onMounted(() => {
  // 初始化擴充功能
  extensionStore.initialize()
  bookmarkStore.loadBookmarks()
})

onUnmounted(() => {
  // 清理資源
  extensionStore.cleanup()
})
</script>

<style scoped>
#citeright-app {
  /* 確保不影響頁面佈局 */
  position: relative;
  z-index: 2147483647;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  color: #333;
}

/* 全域樣式 */
:global(.citeright-link) {
  background: linear-gradient(120deg, #e6f7ff 0%, #f0f9ff 100%) !important;
  border-bottom: 2px dotted #1890ff !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  padding: 2px 4px !important;
  border-radius: 4px !important;
  position: relative !important;
  font-weight: 500 !important;
  box-shadow: 0 1px 3px rgba(24, 144, 255, 0.1) !important;
}

:global(.citeright-link:hover) {
  background: linear-gradient(120deg, #bae7ff 0%, #e6f7ff 100%) !important;
  border-bottom: 2px solid #1890ff !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2) !important;
}

:global(.citeright-link[data-legal-type="law_article"]) {
  border-bottom-color: #52c41a !important;
  background: linear-gradient(120deg, #f6ffed 0%, #f0f9ff 100%) !important;
}

:global(.citeright-link[data-legal-type="interpretation"]) {
  border-bottom-color: #722ed1 !important;
  background: linear-gradient(120deg, #f9f0ff 0%, #f0f9ff 100%) !important;
}
</style>