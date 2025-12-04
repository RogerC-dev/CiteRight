<template>
  <Teleport to="body">
    <!-- Draggable Divider for Split View -->
    <div
      ref="resizeHandleRef"
      class="split-divider"
      :style="dividerStyle"
      @mousedown="startResize"
      @touchstart="startResize"
    >
      <div class="divider-handle"></div>
    </div>

    <!-- Main Tool Panel (Split View) -->
    <div
      id="citeright-tool-panel"
      ref="panelRef"
      class="tool-panel-split"
      :style="panelStyle"
    >
      <!-- Panel Header with Tabs -->
      <div class="panel-header">
        <div class="header-top">
          <h2 class="panel-title">CiteRight</h2>
          <button class="close-btn" @click="$emit('close')" title="關閉面板">
            ×
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
      
      <!-- Tab Content Area -->
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

        <!-- 記憶卡片分頁 -->
        <div
          v-show="currentTab === 'flashcard'"
          id="tab-content-flashcard"
          class="tab-content"
        >
          <div class="tab-content-inner flashcard-content">
            <!-- 模式切換按鈕 -->
            <div class="mode-toggle">
              <button
                @click="showStudyMode = false"
                :class="['mode-btn', { active: !showStudyMode }]"
              >
                🛠️ 管理
              </button>
              <button
                @click="showStudyMode = true"
                :class="['mode-btn', { active: showStudyMode }]"
              >
                🎓 學習
              </button>
            </div>

            <!-- 學習模式 -->
            <div v-if="showStudyMode" class="mode-content">
              <StudySession @create-deck="handleCreateDeck" />
            </div>

            <!-- 管理模式 -->
            <div v-else class="mode-content">
              <FlashcardManager @start-study="handleStartStudy" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import ToolContent from './ToolContent.vue'
import BookmarkContent from './BookmarkContent.vue'
import DictionaryContent from './DictionaryContent.vue'
import FlashcardManager from './FlashcardManager.vue'
import StudySession from './StudySession.vue'

// Props
const props = defineProps({
  width: {
    type: Number,
    default: 420
  },
  currentTab: {
    type: String,
    default: 'tool'
  }
})

// Emits
const emit = defineEmits(['close', 'resize', 'tab-change', 'dictionary-result', 'law-content'])


// Refs
const panelRef = ref(null)
const resizeHandleRef = ref(null)

// State
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const showStudyMode = ref(false)

// Constants
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_RATIO = 0.6

// Tab configuration
const tabs = [
  { id: 'tool', label: '工具', icon: '🔧' },
  { id: 'bookmarks', label: '書籤', icon: '📚' },
  { id: 'dictionary', label: '辭典', icon: '📖' },
  { id: 'flashcard', label: '卡片', icon: '🃏' }
]

// Computed styles for split view
const panelStyle = computed(() => ({
  width: `${props.width}px`
}))

const dividerStyle = computed(() => ({
  right: `${props.width}px`
}))

/**
 * Apply split view - push page content to make room for sidebar
 */
function applySplitView() {
  const html = document.documentElement
  const body = document.body

  const pushWidth = props.width

  // Apply styles to push the page content
  html.style.marginRight = `${pushWidth}px`
  html.style.width = `calc(100% - ${pushWidth}px)`
  html.style.maxWidth = `calc(100vw - ${pushWidth}px)`
  html.style.transition = isResizing.value ? 'none' : 'margin-right 0.15s ease, width 0.15s ease'
  html.style.overflow = 'visible'

  body.style.marginRight = '0'
  body.style.width = '100%'
  body.style.maxWidth = '100%'
  body.style.position = 'relative'

  console.log('✅ Split view applied:', pushWidth + 'px')
}

/**
 * Remove split view - restore page to full width
 */
function removeSplitView() {
  const html = document.documentElement
  const body = document.body

  html.style.marginRight = ''
  html.style.width = ''
  html.style.maxWidth = ''
  html.style.transition = ''
  html.style.overflow = ''

  body.style.marginRight = ''
  body.style.width = ''
  body.style.maxWidth = ''
  body.style.position = ''

  console.log('✅ Split view removed')
}

function switchTab(tabId) {
  if (tabId !== props.currentTab) {
    emit('tab-change', tabId)
  }
}

function handleDictionaryResult(result) {
  if (props.currentTab !== 'tool') {
    emit('tab-change', 'tool')
  }
  emit('dictionary-result', result)
}

function handleLawLoaded(lawData) {
  if (props.currentTab !== 'tool') {
    emit('tab-change', 'tool')
  }
  emit('law-content', lawData)
}

function handleStartStudy(deck) {
  showStudyMode.value = true
}

function handleCreateDeck() {
  showStudyMode.value = false
}

function startResize(e) {
  e.preventDefault()
  isResizing.value = true
  resizeStartX.value = e.clientX || e.touches?.[0]?.clientX || 0
  resizeStartWidth.value = props.width
  
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', handleResize)
  document.addEventListener('touchend', stopResize)
}

function handleResize(e) {
  if (!isResizing.value) return
  
  const clientX = e.clientX || e.touches?.[0]?.clientX || 0
  const deltaX = resizeStartX.value - clientX
  let newWidth = resizeStartWidth.value + deltaX
  
  const maxWidth = window.innerWidth * MAX_PANEL_RATIO
  newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth))

  emit('resize', newWidth)
}

function stopResize() {
  if (!isResizing.value) return
  
  isResizing.value = false

  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
  if (e.key === 'Tab' && e.ctrlKey) {
    e.preventDefault()
    const currentIndex = tabs.findIndex(tab => tab.id === props.currentTab)
    const nextIndex = (currentIndex + 1) % tabs.length
    switchTab(tabs[nextIndex].id)
  }
}

watch(() => props.width, () => {
  applySplitView()
})

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  applySplitView()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)

  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  removeSplitView()
})
</script>

<style scoped>
/* Split View Divider */
.split-divider {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 8px;
  background: #e5e7eb;
  cursor: col-resize;
  z-index: 2147483648;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.split-divider:hover,
.split-divider:active {
  background: #d1d5db;
}

.divider-handle {
  width: 4px;
  height: 48px;
  background: #9ca3af;
  border-radius: 2px;
  transition: background 0.2s, height 0.2s;
}

.split-divider:hover .divider-handle,
.split-divider:active .divider-handle {
  background: #1890ff;
  height: 64px;
}

/* Split View Panel */
.tool-panel-split {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  background: white;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  z-index: 2147483647;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  background: linear-gradient(135deg, #1890ff, #096dd9);
  color: white;
  padding: 12px 16px;
  flex-shrink: 0;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
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
  cursor: pointer;
  font-size: 20px;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.tab-navigation {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.4);
  font-weight: 600;
}

.tab-content-area {
  flex: 1;
  overflow: hidden;
  background: #f8f9fa;
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

/* Flashcard styles */
.flashcard-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mode-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.mode-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  color: #666;
}

.mode-btn:hover {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

.mode-btn.active {
  background: #1890ff;
  color: white;
}

.mode-content {
  padding-top: 48px;
}

/* Disable highlights in dictionary/bookmark areas */
#tab-content-dictionary :deep(.citeright-link),
#tab-content-bookmarks :deep(.citeright-link) {
  background: none !important;
  border: none !important;
  color: inherit !important;
  text-decoration: none !important;
  cursor: default !important;
}

/* Responsive */
@media (max-width: 768px) {
  .tool-panel-split {
    width: 100vw !important;
  }

  .split-divider {
    display: none;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .split-divider,
  .divider-handle,
  .tab-btn,
  .mode-btn,
  .close-btn {
    transition: none;
  }
}
</style>