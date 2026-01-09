<template>
  <Teleport to="body">
    <div
      v-if="show"
      id="citeright-popover"
      ref="popoverRef"
      :style="popoverStyle"
      :class="['citeright-popover', { 'dark-mode': isDarkMode, 'is-resizing': isResizing }]"
      @click.stop
    >
      <!-- Header -->
      <div class="citeright-header" @mousedown="startDrag">
        <div class="header-left">
          <span class="icon"><i class="bi bi-journal-bookmark-fill"></i></span>
          <span class="title">{{ displayTitle }}</span>
        </div>
        <div class="header-right">
          <button
            class="action-btn bookmark-btn"
            @click="handleBookmark"
            :disabled="isBookmarking"
            title="加入書籤"
          >
            <i :class="isAlreadyBookmarked ? 'bi bi-bookmark-check-fill' : 'bi bi-bookmark-plus'"></i>
            {{ isAlreadyBookmarked ? '已收藏' : '收藏' }}
          </button>
          <button class="action-btn expand-btn" @click="$emit('expand')" title="展開至側邊面板">
            <i class="bi bi-arrows-angle-expand"></i> 展開
          </button>
          <button class="action-btn close-btn" @click="$emit('close')" title="關閉">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="citeright-content" :style="contentStyle">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">正在載入{{ loadingMessage }}...</div>
        </div>

        <div v-else-if="error" class="error-state">
          <div class="error-icon"><i class="bi bi-exclamation-circle"></i></div>
          <div class="error-text">{{ error }}</div>
        </div>

        <div v-else-if="contentData" class="content-loaded">
          <!-- Interpretation Content -->
          <template v-if="kind === 'interpretation'">
            <div v-if="contentData.date" class="info-section">
              <strong><i class="bi bi-calendar3"></i> 解釋公布院令：</strong>
              <div class="info-content">{{ new Date(contentData.date).toLocaleDateString() }}</div>
            </div>
            <div v-if="contentData.chinese?.issue || contentData.issue" class="info-section highlight-section">
              <strong><i class="bi bi-question-circle"></i> 解釋爭點：</strong>
              <div class="info-content">{{ contentData.chinese?.issue || contentData.issue }}</div>
            </div>

            <div v-if="contentData.chinese?.description || contentData.description" class="info-section">
              <strong><i class="bi bi-file-text"></i> 解釋文：</strong>
              <div class="info-content">{{ contentData.chinese?.description || contentData.description }}</div>
            </div>

            <div v-if="contentData.chinese?.reasoning || contentData.reasoning" class="info-section">
              <strong><i class="bi bi-journal-text"></i> 理由書：</strong>
              <div class="info-content">{{ contentData.chinese?.reasoning || contentData.reasoning }}</div>
            </div>
            <div class="info-section">
              <strong><i class="bi bi-link-45deg"></i> 來源：</strong>
              <div class="info-content">
                <a :href="contentData.url || getInterpretationUrl(contentData.number)" target="_blank" rel="noreferrer">
                  <i class="bi bi-box-arrow-up-right"></i> 線上解釋來源
                </a>
                <span v-if="contentData.source_url"> |
                  <a :href="contentData.source_url" target="_blank" rel="noreferrer">
                    <i class="bi bi-database"></i> 資料庫來源
                  </a>
                </span>
              </div>
            </div>
          </template>

          <!-- Law Content -->
          <template v-else-if="kind === 'law'">
            <div v-if="contentData.LawModifiedDate" class="info-section">
              <strong><i class="bi bi-calendar3"></i> 修訂日期：</strong>
              <div class="info-content">{{ new Date(contentData.LawModifiedDate).toLocaleDateString() }}</div>
            </div>
            <div v-if="Array.isArray(contentData.Articles) && contentData.Articles.length" class="info-section">
              <strong><i class="bi bi-list-ol"></i> 條文內容：</strong>
              <div class="law-articles-container">
                <div
                  v-for="(article, index) in contentData.Articles"
                  :key="index"
                  class="law-article-item"
                >
                  <div class="article-header">
                    <span class="article-number">{{ article.ArticleNo }}</span>
                    <span v-if="article.CaptionTitle" class="article-caption">{{ article.CaptionTitle }}</span>
                  </div>
                  <div class="article-content">{{ article.Article }}</div>
                </div>
              </div>
            </div>
            <div v-if="contentData.LawUrl" class="info-section">
              <strong><i class="bi bi-link-45deg"></i> 來源：</strong>
              <div class="info-content">
                <a :href="contentData.LawUrl" target="_blank" rel="noreferrer">
                  <i class="bi bi-box-arrow-up-right"></i> 線上法條來源
                </a>
              </div>
            </div>
          </template>

          <!-- Fallback Content -->
          <template v-else>
            <div class="info-section">
              <strong><i class="bi bi-info-circle"></i> 識別內容：</strong> {{ contentData.text || data?.text || '未知內容' }}
            </div>
            <div class="debug-info">
              類型: {{ contentData.type || '未知' }}<br>
              <template v-if="lawName">法律: {{ lawName }}<br></template>
              <template v-if="article">條文: {{ article }}<br></template>
              <template v-if="paragraph">條款: {{ paragraph }}<br></template>
              <template v-if="year">年度: {{ year }}<br></template>
              <template v-if="number">字號: {{ number }}<br></template>
            </div>
          </template>
        </div>

        <div v-else class="no-data">
          <div class="no-data-icon"><i class="bi bi-folder2-open"></i></div>
          <div class="no-data-text">尚無資料</div>
        </div>
      </div>

      <!-- Resize Handles -->
      <div class="resize-handle resize-handle-e" @mousedown="startResize($event, 'e')" title="拖曳調整寬度"></div>
      <div class="resize-handle resize-handle-s" @mousedown="startResize($event, 's')" title="拖曳調整高度"></div>
      <div class="resize-handle resize-handle-se" @mousedown="startResize($event, 'se')" title="拖曳調整大小">
        <i class="bi bi-arrows-angle-expand"></i>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { fetchInterpretation, fetchLawInfo } from '../../services/apiService.js'
import { useBookmarkStore } from '../../stores/bookmark.js'
import { usePopoverStore } from '../../stores/popover.js'

// Theme storage key - must match ThemeManager
const THEME_STORAGE_KEY = 'precedent-theme'

// Props
const props = defineProps({
  show: { type: Boolean, default: false },
  triggerElement: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  data: { type: Object, default: null },
  error: { type: String, default: '' }
})

// Emits
const emit = defineEmits(['close', 'bookmark', 'expand'])

// State
const bookmarkStore = useBookmarkStore()
const popoverStore = usePopoverStore()
const popoverRef = ref(null)
const contentData = ref(null)
const loading = ref(false)
const error = ref('')
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const isBookmarking = ref(false)
const isDarkMode = ref(false)

// Resize state
const isResizing = ref(false)
const resizeDirection = ref('')
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 480, height: 320 })
const popoverSize = ref({ width: 480, height: 320 })
const MIN_WIDTH = 320
const MAX_WIDTH = 800
const MIN_HEIGHT = 200
const MAX_HEIGHT = 600

// Theme detection and sync
async function loadThemePreference() {
  try {
    let savedTheme = null
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      savedTheme = await new Promise((resolve) => {
        chrome.storage.local.get([THEME_STORAGE_KEY], (res) => {
          resolve(res[THEME_STORAGE_KEY])
        })
      })
    }
    
    if (!savedTheme) {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    }
    
    if (savedTheme === 'dark') {
      isDarkMode.value = true
    } else if (savedTheme === 'light') {
      isDarkMode.value = false
    } else {
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    // Listen for chrome.storage changes (from popup or sidebar)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[THEME_STORAGE_KEY]) {
          const newTheme = changes[THEME_STORAGE_KEY].newValue
          isDarkMode.value = newTheme === 'dark'
        }
      })
    }
    
    // Listen for runtime messages (from popup)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'THEME_CHANGED') {
          isDarkMode.value = message.effectiveTheme === 'dark' || message.theme === 'dark'
          sendResponse({ success: true })
        }
      })
    }
    
    // Listen for localStorage changes
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        isDarkMode.value = e.newValue === 'dark'
      }
    })
  } catch (e) {
    isDarkMode.value = document.documentElement.classList.contains('dark')
  }
}

function handleThemeChange(e) {
  isDarkMode.value = e.detail?.theme === 'dark'
}

onMounted(() => {
  loadThemePreference()
  loadSavedSize()
  window.addEventListener('themeChanged', handleThemeChange)
})

onUnmounted(() => {
  window.removeEventListener('themeChanged', handleThemeChange)
})

// Normalized helpers for mixed shapes
const lawName = computed(() => props.data?.lawName ?? props.data?.value?.lawName)
const article = computed(() => props.data?.article ?? props.data?.value?.article)
const paragraph = computed(() => props.data?.paragraph ?? props.data?.value?.paragraph)
const year = computed(() => props.data?.year ?? props.data?.value?.year)
const number = computed(() => props.data?.number ?? props.data?.value?.number)

const kind = computed(() => {
  const t = (contentData.value?.type || props.data?.type || '').toString().toLowerCase()
  if (t === '法律' || t === 'law') return 'law'
  if (t === '釋字' || t === 'interpretation') return 'interpretation'
  return 'other'
})

const displayTitle = computed(() => {
  const cd = contentData.value
  if (!cd) return props.data?.title || '法律資訊'
  switch (kind.value) {
    case 'interpretation':
      return `釋字第 ${cd?.number ?? ''} 號`
    case 'law':
      return cd?.LawName || props.data?.title || lawName.value || '法律內容'
    default:
      return props.data?.title || '臺灣法律資訊'
  }
})

const loadingMessage = computed(() => {
  const t = (props.data?.type || '').toString().toLowerCase()
  if (t === '釋字' || t === 'interpretation') return '釋字內容'
  if (t === '法律' || t === 'law') return '法律內容'
  return '內容'
})

const popoverStyle = computed(() => {
  const baseStyle = {
    position: 'fixed',
    zIndex: 2147483650,
    width: `${popoverSize.value.width}px`
  }

  if (!props.triggerElement) {
    return {
      ...baseStyle,
      left: '100px',
      top: '100px'
    }
  }

  const rect = props.triggerElement.getBoundingClientRect()
  let left = rect.left
  let top = rect.bottom + 5

  const popoverWidth = popoverSize.value.width
  const popoverHeight = popoverSize.value.height

  const sidebarElement = document.getElementById('citeright-tool-panel')
  let availableWidth = window.innerWidth

  if (sidebarElement) {
    const sidebarRect = sidebarElement.getBoundingClientRect()
    const sidebarWidth = sidebarRect.width
    if (sidebarRect.left < window.innerWidth) {
      availableWidth = Math.max(400, window.innerWidth - sidebarWidth - 20)
    }
  }

  if (left + popoverWidth > availableWidth) {
    left = Math.max(10, availableWidth - popoverWidth - 10)
  }
  if (left < 10) left = 10

  if (top + popoverHeight > window.innerHeight) {
    top = rect.top - popoverHeight - 5
    if (top < 10) top = 10
  }

  return {
    ...baseStyle,
    left: `${left}px`,
    top: `${top}px`
  }
})

const contentStyle = computed(() => ({
  maxHeight: `${popoverSize.value.height}px`
}))

const isAlreadyBookmarked = computed(() => {
  if (!contentData.value && !props.data) return false

  const dataToCheck = contentData.value || props.data
  return bookmarkStore.bookmarks.some(bookmark => {
    if (bookmark.id === dataToCheck.id) return true
    if (bookmark.type === 'interpretation' && dataToCheck.type === 'interpretation') {
      return bookmark.number === dataToCheck.number
    }
    if (bookmark.type === 'law' && dataToCheck.type === 'law') {
      return bookmark.lawName === dataToCheck.lawName ||
             bookmark.LawName === dataToCheck.LawName ||
             bookmark.title === dataToCheck.title
    }
    if (bookmark.lawName && dataToCheck.lawName && bookmark.article && dataToCheck.article) {
      return bookmark.lawName === dataToCheck.lawName && bookmark.article === dataToCheck.article
    }
    if (bookmark.title === dataToCheck.title && bookmark.title.length > 5) {
      return true
    }
    return false
  })
})

watch(
  () => props.data,
  async (newData) => {
    if (!newData) {
      contentData.value = null
      error.value = ''
      return
    }
    await loadContent(newData)
  },
  { immediate: true }
)

watch(
  () => props.show,
  (show) => {
    if (show) {
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }
)

async function loadContent(data) {
  if (!data) return
  loading.value = true
  error.value = ''
  try {
    const caseType = (data.type || '').toString().toLowerCase()
    if (caseType === '釋字' || caseType === 'interpretation') {
      if (data.issue || data.description || data.reasoning || data.chinese?.issue || data.chinese?.description) {
        contentData.value = {
          type: 'interpretation',
          number: data.number,
          title: data.title,
          ...data
        }
      } else {
        const result = await fetchInterpretation(data.number)
        contentData.value = result
      }
    } else if (caseType === '法律' || caseType === 'law') {
      if (data.content && data.content !== `正在載入${data.lawName}的詳細內容..`) {
        contentData.value = {
          type: '法律',
          LawName: data.lawName || data.title,
          LawUrl: data.officialUrl,
          content: data.content,
          ...data
        }
      } else if (data.lawName) {
        const result = await fetchLawInfo(data.lawName)
        contentData.value = result
      } else {
        contentData.value = {
          type: '法律',
          LawName: data.title || '法律資訊',
          ...data
        }
      }
    } else {
      contentData.value = { type: caseType || '其他', title: data.title || '臺灣法律資訊', ...data }
    }
  } catch (err) {
    console.error('載入內容失敗:', err)
    error.value = err?.message || '載入內容發生錯誤'
    contentData.value = null
  } finally {
    loading.value = false
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

function startDrag(e) {
  if (e.target.classList?.contains('action-btn')) return
  isDragging.value = true
  popoverStore.setDragging(true) // Notify store that dragging started
  const rect = popoverRef.value.getBoundingClientRect()
  dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function handleDrag(e) {
  if (!isDragging.value || !popoverRef.value) return
  let left = e.clientX - dragOffset.value.x
  let top = e.clientY - dragOffset.value.y
  const popoverRect = popoverRef.value.getBoundingClientRect()
  left = Math.max(0, Math.min(left, window.innerWidth - popoverRect.width))
  top = Math.max(0, Math.min(top, window.innerHeight - 50))
  popoverRef.value.style.left = left + 'px'
  popoverRef.value.style.top = top + 'px'
}

function stopDrag() {
  isDragging.value = false
  popoverStore.setDragging(false) // Notify store that dragging stopped
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Resize functions
function startResize(e, direction) {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  popoverStore.setResizing(true) // Notify store that resizing started
  resizeDirection.value = direction
  resizeStartPos.value = { x: e.clientX, y: e.clientY }
  resizeStartSize.value = { ...popoverSize.value }
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = getCursorForDirection(direction)
  document.body.style.userSelect = 'none'
}

function handleResize(e) {
  if (!isResizing.value) return
  
  const deltaX = e.clientX - resizeStartPos.value.x
  const deltaY = e.clientY - resizeStartPos.value.y
  
  let newWidth = resizeStartSize.value.width
  let newHeight = resizeStartSize.value.height
  
  if (resizeDirection.value.includes('e')) {
    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartSize.value.width + deltaX))
  }
  if (resizeDirection.value.includes('s')) {
    newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartSize.value.height + deltaY))
  }
  
  popoverSize.value = { width: newWidth, height: newHeight }
}

function stopResize() {
  isResizing.value = false
  popoverStore.setResizing(false) // Notify store that resizing stopped
  resizeDirection.value = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  // Save size preference
  try {
    localStorage.setItem('citeright-popover-size', JSON.stringify(popoverSize.value))
  } catch (e) {
    console.warn('Failed to save popover size:', e)
  }
}

function getCursorForDirection(direction) {
  const cursors = {
    'e': 'ew-resize',
    's': 'ns-resize',
    'se': 'nwse-resize'
  }
  return cursors[direction] || 'default'
}

// Load saved size on mount
function loadSavedSize() {
  try {
    const saved = localStorage.getItem('citeright-popover-size')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.width && parsed.height) {
        popoverSize.value = {
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
          height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parsed.height))
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load popover size:', e)
  }
}

function getInterpretationUrl(number) {
  return `https://cons.judicial.gov.tw/docdata.aspx?fid=100&type=JY&RD=${number}`
}

async function handleBookmark() {
  const dataToBookmark = contentData.value || props.data

  if (!dataToBookmark || isBookmarking.value) {
    return
  }

  isBookmarking.value = true

  try {
    const bookmarkData = {
      ...dataToBookmark,
      id: dataToBookmark.id || `${dataToBookmark.type || 'law'}_${Date.now()}`,
      title: dataToBookmark.title || displayTitle.value,
      type: dataToBookmark.type || 'law',
      dateAdded: new Date().toISOString()
    }

    if (isAlreadyBookmarked.value) {
      const success = bookmarkStore.removeBookmark(bookmarkData.id)
      if (success) {
        console.log('Bookmark removed:', bookmarkData.title)
      }
    } else {
      const success = bookmarkStore.addBookmark(bookmarkData)
      if (success) {
        console.log('Bookmark added:', bookmarkData.title)
      }
    }
  } catch (error) {
    console.error('Bookmark operation failed:', error)
  } finally {
    isBookmarking.value = false
  }
}
</script>

<style scoped>
/* Design System Variables (inline for content script isolation) */
.citeright-popover {
  --primary: #476996;
  --primary-hover: #35527a;
  --primary-soft: #EEF2FF;
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --surface: #FFFFFF;
  --surface-muted: #E2E8F0;
  --border: #CBD5E1;
  --success: #22c55e;
  --radius: 12px;
  --radius-sm: 8px;
  
  background: var(--surface);
  border: 2px solid var(--primary);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.15);
  width: 480px;
  max-width: 95vw;
  font-family: "Inter", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
  font-size: 14px;
  color: var(--text-primary);
  pointer-events: auto;
}

.citeright-header {
  padding: 14px 18px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: white;
  border-radius: 10px 10px 0 0;
  cursor: move;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.title {
  font-weight: 600;
  font-size: 15px;
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: inherit;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.close-btn {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.close-btn i {
  font-size: 14px;
}

.citeright-content {
  padding: 18px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--surface);
  border-radius: 0 0 10px 10px;
  line-height: 1.6;
}

.citeright-content::-webkit-scrollbar {
  width: 6px;
}

.citeright-content::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.loading-state,
.error-state,
.no-data {
  text-align: center;
  padding: 24px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--surface-muted);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.error-icon,
.no-data-icon {
  font-size: 32px;
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.error-text,
.no-data-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.info-section {
  margin-bottom: 14px;
}

.info-section strong {
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 13px;
}

.info-section strong i {
  font-size: 14px;
}

.info-content {
  line-height: 1.7;
  color: var(--text-primary);
}

.info-content a {
  color: var(--primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.info-content a:hover {
  text-decoration: underline;
}

.highlight-section {
  background: var(--primary-soft);
  padding: 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--primary);
}

.debug-info {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.content-loaded {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Law Articles */
.law-articles-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.law-articles-container::-webkit-scrollbar {
  width: 6px;
}

.law-articles-container::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: 3px;
}

.law-articles-container::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.law-article-item {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.law-article-item:last-child {
  border-bottom: none;
}

.article-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.article-number {
  background: linear-gradient(135deg, var(--success), #16a34a);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.article-caption {
  color: var(--primary);
  font-weight: 600;
  font-size: 13px;
}

.article-content {
  color: var(--text-primary);
  line-height: 1.7;
  font-size: 13px;
}

/* Dark mode support - Applied via class */
.citeright-popover.dark-mode {
  --primary: #60a5fa;
  --primary-hover: #3b82f6;
  --primary-soft: #1e3a5f;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --surface: #1e293b;
  --surface-muted: #334155;
  --border: #475569;
  --success: #4ade80;
  border-color: #334155;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

/* Dark mode header - softer, eye-friendly gradient */
.citeright-popover.dark-mode .citeright-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
}

/* Dark mode content area */
.citeright-popover.dark-mode .citeright-content {
  background: #1e293b;
}

/* Dark mode loading state */
.citeright-popover.dark-mode .loading-state {
  color: #94a3b8;
}

/* Dark mode error state */
.citeright-popover.dark-mode .error-state {
  background: rgba(239, 68, 68, 0.1);
}

/* Dark mode section headers */
.citeright-popover.dark-mode .section-header {
  background: #334155;
  color: #f1f5f9;
}

/* Dark mode law articles */
.citeright-popover.dark-mode .law-article-item {
  background: #0f172a;
  border-color: #334155;
}

/* Dark mode scrollbar */
.citeright-popover.dark-mode .citeright-content::-webkit-scrollbar-track,
.citeright-popover.dark-mode .law-articles-container::-webkit-scrollbar-track {
  background: #1e293b;
}

.citeright-popover.dark-mode .citeright-content::-webkit-scrollbar-thumb,
.citeright-popover.dark-mode .law-articles-container::-webkit-scrollbar-thumb {
  background: #475569;
}

.citeright-popover.dark-mode .citeright-content::-webkit-scrollbar-thumb:hover,
.citeright-popover.dark-mode .law-articles-container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  z-index: 10;
}

.resize-handle-e {
  top: 50px;
  right: 0;
  width: 6px;
  height: calc(100% - 60px);
  cursor: ew-resize;
  background: transparent;
}

.resize-handle-e:hover {
  background: linear-gradient(to right, transparent, rgba(71, 105, 150, 0.3));
}

.resize-handle-s {
  bottom: 0;
  left: 10px;
  width: calc(100% - 40px);
  height: 6px;
  cursor: ns-resize;
  background: transparent;
}

.resize-handle-s:hover {
  background: linear-gradient(to bottom, transparent, rgba(71, 105, 150, 0.3));
}

.resize-handle-se {
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, transparent 40%, var(--primary-soft) 40%);
  border-radius: 0 0 var(--radius) 0;
  transition: all 0.2s;
}

.resize-handle-se i {
  font-size: 10px;
  color: var(--primary);
  opacity: 0.6;
  transform: rotate(90deg);
  position: absolute;
  bottom: 3px;
  right: 3px;
}

.resize-handle-se:hover {
  background: linear-gradient(135deg, transparent 30%, var(--primary-soft) 30%);
}

.resize-handle-se:hover i {
  opacity: 1;
}

/* Resizing state */
.citeright-popover.is-resizing {
  user-select: none;
}

.citeright-popover.is-resizing .citeright-content {
  pointer-events: none;
}

/* Dark mode resize handles */
.citeright-popover.dark-mode .resize-handle-e:hover {
  background: linear-gradient(to right, transparent, rgba(96, 165, 250, 0.3));
}

.citeright-popover.dark-mode .resize-handle-s:hover {
  background: linear-gradient(to bottom, transparent, rgba(96, 165, 250, 0.3));
}

.citeright-popover.dark-mode .resize-handle-se {
  background: linear-gradient(135deg, transparent 40%, rgba(96, 165, 250, 0.15) 40%);
}

.citeright-popover.dark-mode .resize-handle-se:hover {
  background: linear-gradient(135deg, transparent 30%, rgba(96, 165, 250, 0.25) 30%);
}

.citeright-popover.dark-mode .resize-handle-se i {
  color: #60a5fa;
}
</style>
