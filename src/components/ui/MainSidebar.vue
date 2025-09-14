<template>
  <Teleport to="body">
    <!-- 側邊欄背景 -->
    <div
      id="citeright-sidebar-background"
      :class="['sidebar-background', { active: isFloating }]"
      :style="backgroundStyle"
    ></div>
    
    <!-- 主工具面板 -->
    <div
      id="citeright-tool-panel"
      ref="panelRef"
      :class="['tool-panel', { floating: isFloating }]"
      :style="panelStyle"
    >
      <!-- 調整大小控制桿 -->
      <div
        ref="resizeHandleRef"
        class="resize-handle"
        @mouseenter="handleResizeHover(true)"
        @mouseleave="handleResizeHover(false)"
        @mousedown="startResize"
      ></div>
      
      <!-- 標題欄和分頁導航 -->
      <div class="panel-header">
        <div class="header-top">
          <h2 class="panel-title">CiteRight 工具面板</h2>
          <button class="close-btn" @click="$emit('close')" title="關閉面板">
            &times;
          </button>
        </div>
        
        <div class="tab-navigation">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: currentTab === tab.id }]"
            @click="switchTab(tab.id)"
          >
            {{ tab.icon }} {{ tab.label }}
          </button>
        </div>
      </div>
      
      <!-- 分頁內容區域 -->
      <div class="tab-content-area">
        <!-- 法律工具分頁 -->
        <div
          v-show="currentTab === 'tool'"
          id="tab-content-tool"
          class="tab-content"
        >
          <div class="tab-content-inner">
            <ToolContent />
          </div>
        </div>
        
        <!-- 書籤分頁 -->
        <div
          v-show="currentTab === 'bookmarks'"
          id="tab-content-bookmarks"
          class="tab-content"
        >
          <div class="tab-content-inner">
            <BookmarkContent />
          </div>
        </div>
        
        <!-- 法律辭典分頁 -->
        <div
          v-show="currentTab === 'dictionary'"
          id="tab-content-dictionary"
          class="tab-content"
        >
          <div class="tab-content-inner">
            <DictionaryContent 
              @result-selected="handleDictionaryResult"
              @law-loaded="handleLawLoaded"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import ToolContent from './ToolContent.vue'
import BookmarkContent from './BookmarkContent.vue'
import DictionaryContent from './DictionaryContent.vue'

// Props
const props = defineProps({
  width: {
    type: Number,
    default: 500
  },
  currentTab: {
    type: String,
    default: 'tool'
  }
})

// Emits
const emit = defineEmits(['close', 'resize', 'tab-change', 'dictionary-result', 'law-content'])

// 引用
const panelRef = ref(null)
const resizeHandleRef = ref(null)

// 狀態
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const isHoveringHandle = ref(false)

// 分頁配置
const tabs = [
  { id: 'tool', label: '法律工具', icon: '🔧' },
  { id: 'bookmarks', label: '我的書籤', icon: '📚' },
  { id: 'dictionary', label: '法律辭典', icon: '📖' }
]

// 計算屬性
const sidebarBoundary = computed(() => Math.floor(window.innerWidth / 3))
const isFloating = computed(() => props.width > sidebarBoundary.value)

const backgroundStyle = computed(() => ({
  width: `${sidebarBoundary.value}px`,
  opacity: isFloating.value ? '1' : '0'
}))

const panelStyle = computed(() => ({
  width: `${props.width}px`,
  zIndex: isFloating.value ? '2147483648' : '2147483647',
  boxShadow: isFloating.value 
    ? '-8px 0 24px rgba(0,0,0,0.25)' 
    : '-6px 0 18px rgba(0,0,0,0.15)',
  transform: 'translateX(0)' // 確保可見
}))

/**
 * 切換分頁
 */
function switchTab(tabId) {
  if (tabId !== props.currentTab) {
    emit('tab-change', tabId)
  }
}

/**
 * 處理法律辭典搜尋結果選擇
 */
function handleDictionaryResult(result) {
  console.log('📚 辭典結果選擇:', result)
  
  // 切換到工具分頁顯示詳細內容
  if (props.currentTab !== 'tool') {
    emit('tab-change', 'tool')
  }
  
  // 發送結果到父組件
  emit('dictionary-result', result)
}

/**
 * 處理法律內容載入
 */
function handleLawLoaded(lawData) {
  console.log('📖 法律內容載入:', lawData)
  
  // 切換到工具分頁顯示內容
  if (props.currentTab !== 'tool') {
    emit('tab-change', 'tool')
  }
  
  // 發送法律內容到父組件
  emit('law-content', lawData)
}

/**
 * 處理調整大小控制桿懸停
 */
function handleResizeHover(hovering) {
  if (!isResizing.value) {
    isHoveringHandle.value = hovering
  }
}

/**
 * 開始調整大小
 */
function startResize(e) {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = props.width
  
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  
  emit('resize', { type: 'start', width: props.width })
  
  console.log('🔧 開始調整面板大小')
  e.preventDefault()
}

/**
 * 處理調整大小
 */
function handleResize(e) {
  if (!isResizing.value) return
  
  const deltaX = resizeStartX.value - e.clientX // 反向拖拽（向左擴展）
  let newWidth = resizeStartWidth.value + deltaX
  
  // 應用寬度限制
  const minWidth = sidebarBoundary.value
  const maxWidth = window.innerWidth * 0.8
  newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
  
  emit('resize', newWidth)
  
  console.log('🔄 調整面板寬度:', newWidth + 'px')
}

/**
 * 停止調整大小
 */
function stopResize() {
  if (!isResizing.value) return
  
  isResizing.value = false
  isHoveringHandle.value = false
  
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  
  emit('resize', props.width)
  
  console.log('✅ 完成面板大小調整')
}

/**
 * 處理鍵盤快捷鍵
 */
function handleKeyDown(e) {
  // ESC 鍵關閉面板
  if (e.key === 'Escape') {
    emit('close')
  }
  
  // Tab 鍵切換分頁
  if (e.key === 'Tab' && e.ctrlKey) {
    e.preventDefault()
    const currentIndex = tabs.findIndex(tab => tab.id === props.currentTab)
    const nextIndex = (currentIndex + 1) % tabs.length
    switchTab(tabs[nextIndex].id)
  }
}

// 生命週期
onMounted(() => {
  console.log('📱 MainSidebar 組件已掛載')
  
  // 添加鍵盤事件監聽
  document.addEventListener('keydown', handleKeyDown)
  
  // 確保面板可見
  nextTick(() => {
    if (panelRef.value) {
      panelRef.value.style.transform = 'translateX(0)'
    }
  })
})

onUnmounted(() => {
  console.log('📱 MainSidebar 組件即將卸載')
  
  // 清理事件監聽
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  
  // 重置 body 樣式
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

// 監聽寬度變化，更新調整大小狀態
watch(() => props.width, (newWidth) => {
  console.log('📏 面板寬度更新:', newWidth + 'px')
})
</script>

<style scoped>
.sidebar-background {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  background: rgba(24, 144, 255, 0.03);
  border-left: 1px solid rgba(24, 144, 255, 0.1);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2147483645;
}

.sidebar-background.active {
  opacity: 1;
}

.tool-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  background: white;
  border-left: 3px solid #1890ff;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  font-size: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 2147483647;
}

.tool-panel.floating {
  z-index: 2147483648;
}

.resize-handle {
  position: absolute;
  left: -6px;
  top: 0;
  bottom: 0;
  width: 12px;
  background: linear-gradient(90deg, rgba(24, 144, 255, 0.5), #1890ff);
  cursor: ew-resize;
  z-index: 10;
  opacity: 0.8;
  transition: all 0.2s;
  border-radius: 4px 0 0 4px;
  box-shadow: -2px 0 8px rgba(24, 144, 255, 0.3);
}

.resize-handle:hover {
  opacity: 1;
  background: linear-gradient(90deg, rgba(24, 144, 255, 0.8), #1890ff);
}

.panel-header {
  background: linear-gradient(135deg, #1890ff, #096dd9);
  color: white;
  padding: 16px;
  flex-shrink: 0;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 50%;
  padding: 8px;
  cursor: pointer;
  font-size: 18px;
  width: 36px;
  height: 36px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.tab-navigation {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.4);
  font-weight: 600;
}

.tab-content-area {
  flex: 1;
  overflow: hidden;
  background: #fafafa;
}

.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content-inner {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: white;
  margin: 8px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.tab-content-inner::-webkit-scrollbar {
  width: 6px;
}

.tab-content-inner::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.tab-content-inner::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.tab-content-inner::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 動畫 */
.tool-panel {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .tool-panel {
    width: 100vw !important;
    left: 0;
    right: 0;
  }
  
  .resize-handle {
    display: none;
  }
}

/* 無障礙設計 */
@media (prefers-reduced-motion: reduce) {
  .tool-panel,
  .tab-btn {
    transition: none;
  }
  
  @keyframes slideIn {
    from, to {
      transform: translateX(0);
    }
  }
}
</style>