<template>
  <Teleport to="body">
    <!-- Draggable Divider for Split View -->
    <div
      ref="resizeHandleRef"
      :class="['split-divider', { 'dark-mode': isDarkMode }]"
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
      :class="['tool-panel-split', { 'dark-mode': isDarkMode }]"
      :style="panelStyle"
    >
      <!-- Panel Header with Tabs -->
      <div class="panel-header">
        <div class="header-top">
          <div class="header-brand">
            <span class="brand-icon"><i class="bi bi-journal-bookmark-fill"></i></span>
            <h2 class="panel-title">CiteRight</h2>
          </div>
          <div class="header-actions">
            <button class="header-btn" @click="toggleTheme" title="切換主題">
              <i :class="isDarkMode ? 'bi bi-sun-fill' : 'bi bi-moon-fill'"></i>
            </button>
            <button class="close-btn" @click="$emit('close')" title="關閉面板">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
        
        <div class="tab-navigation">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: currentTab === tab.id }]"
            @click="switchTab(tab.id)"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </div>
      
      <!-- Tab Content Area -->
      <div class="tab-content-area">
        <!-- Tool Tab -->
        <div
          v-show="currentTab === 'tool'"
          id="tab-content-tool"
          class="tab-content"
        >
          <div class="tab-content-inner">
            <ToolContent />
          </div>
        </div>
        
        <!-- Bookmarks Tab -->
        <div
          v-show="currentTab === 'bookmarks'"
          id="tab-content-bookmarks"
          class="tab-content"
        >
          <div class="tab-content-inner">
            <BookmarkContent />
          </div>
        </div>
        
        <!-- Dictionary Tab -->
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



        <!-- AI Chat Tab -->
        <div
          v-show="currentTab === 'chat'"
          id="tab-content-chat"
          class="tab-content"
        >
          <div class="chat-container">
            <!-- Chat Sub-tabs -->
            <div class="chat-tabs">
              <button 
                :class="{ active: chatSubTab === 'chat' }" 
                @click="chatSubTab = 'chat'"
              >
                <i class="bi bi-chat-dots"></i> 對話
              </button>
              <button 
                :class="{ active: chatSubTab === 'history' }" 
                @click="chatSubTab = 'history'"
              >
                <i class="bi bi-clock-history"></i> 歷史記錄
              </button>
            </div>

            <!-- Chat Panel -->
            <div v-if="chatSubTab === 'chat'" class="chat-panel">
              <!-- Server Status Indicator -->
              <div v-if="chatStore.serverStatus !== 'online'" class="server-status-banner" :class="chatStore.serverStatus">
                <i :class="chatStore.serverStatus === 'checking' ? 'bi bi-hourglass-split' : 'bi bi-exclamation-triangle'"></i>
                <span v-if="chatStore.serverStatus === 'checking'">正在連線到 AI 伺服器...</span>
                <span v-else>AI 伺服器離線。請啟動後端服務 (cd server && npm start)</span>
                <button v-if="chatStore.serverStatus === 'offline'" @click="chatStore.checkServerStatus" class="retry-btn">
                  <i class="bi bi-arrow-clockwise"></i> 重試
                </button>
              </div>

              <div class="chat-messages" ref="messagesContainer">
                <!-- 歡迎訊息 -->
                <div v-if="!chatStore.hasMessages" class="welcome-message">
                  <i class="bi bi-robot"></i>
                  <h3>AI 法律助手</h3>
                  <p>有任何法律、案例或法律概念的問題，歡迎隨時詢問。</p>
                  <div class="example-prompts">
                    <p class="prompts-title">試試這些問題：</p>
                    <button @click="useExamplePrompt('什麼是民法第184條的侵權行為？')">什麼是民法第184條的侵權行為？</button>
                    <button @click="useExamplePrompt('解釋刑法上的正當防衛')">解釋刑法上的正當防衛</button>
                    <button @click="useExamplePrompt('公司設立需要哪些程序？')">公司設立需要哪些程序？</button>
                  </div>
                </div>
                
                <!-- Messages -->
                <div
                  v-for="(msg, index) in chatStore.messages"
                  :key="index"
                  :class="['message', msg.role]"
                >
                  <div class="message-avatar">
                    <i :class="msg.role === 'user' ? 'bi bi-person-fill' : 'bi bi-robot'"></i>
                  </div>
                  <div class="message-content">
                    <div class="message-text" v-html="formatMessage(msg.content)"></div>
                    <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                  </div>
                </div>
                
                <!-- Loading indicator -->
                <div v-if="chatStore.isLoading" class="message assistant">
                  <div class="message-avatar">
                    <i class="bi bi-robot"></i>
                  </div>
                  <div class="message-content">
                    <div class="message-text typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Error message -->
              <div v-if="chatStore.errorMessage" class="error-message">
                <i class="bi bi-exclamation-triangle"></i>
                {{ chatStore.errorMessage }}
              </div>

              <!-- Chat Input -->
              <div class="chat-input-container">
                <div class="resize-handle-top" @mousedown="startInputResize" @touchstart="startInputResize"></div>
                <textarea
                  ref="chatInputRef"
                  v-model="chatInputMessage"
                  @keydown.enter.exact.prevent="handleSendMessage"
                  @keydown.enter.shift.exact.prevent="insertNewline"
                  placeholder="請輸入法律相關問題..."
                  class="chat-input"
                  :disabled="chatStore.isLoading"
                  :style="{ minHeight: inputHeight + 'px' }"
                ></textarea>
                <button
                  @click="handleSendMessage"
                  class="btn-send"
                  :disabled="!chatInputMessage.trim() || chatStore.isLoading"
                  title="發送"
                >
                  <i class="bi bi-send-fill"></i>
                </button>
              </div>
            </div>

            <!-- 歷史記錄面板 -->
            <div v-else-if="chatSubTab === 'history'" class="history-panel">
              <div class="history-toolbar">
                <button 
                  class="btn-refresh" 
                  @click="chatStore.refreshHistory" 
                  :disabled="chatStore.isHistoryLoading"
                >
                  <i class="bi bi-arrow-clockwise"></i> 重新整理
                </button>
                <button 
                  class="btn-new-chat" 
                  @click="startNewChat"
                >
                  <i class="bi bi-plus-lg"></i> 新對話
                </button>
              </div>
              
              <div v-if="chatStore.isHistoryLoading" class="history-placeholder">
                <i class="bi bi-hourglass-split"></i> 載入中...
              </div>
              <div v-else-if="!chatStore.hasHistory" class="history-placeholder">
                <i class="bi bi-chat-square-text"></i>
                <span>尚無對話記錄</span>
              </div>
              <div v-else class="history-list">
                <div 
                  v-for="item in chatStore.historyItems" 
                  :key="item.id" 
                  class="history-item"
                >
                  <div class="history-question">
                    <strong><i class="bi bi-person-fill"></i></strong>
                    <span v-html="formatMessage(item.message)"></span>
                  </div>
                  <div v-if="item.response" class="history-answer">
                    <strong><i class="bi bi-robot"></i></strong>
                    <span v-html="truncateText(item.response, 150)"></span>
                  </div>
                  <div class="history-meta">{{ formatTime(item.created_at) }}</div>
                  <div class="history-actions">
                    <button class="history-reuse" @click="reuseHistory(item)">
                      <i class="bi bi-arrow-return-left"></i> Reuse
                    </button>
                    <button class="history-edit" @click="editHistory(item)">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
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

import { useChatStore } from '../../stores/chat'

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

// Stores

const chatStore = useChatStore()

// Refs
const panelRef = ref(null)
const resizeHandleRef = ref(null)
const messagesContainer = ref(null)
const chatInputRef = ref(null)

// State
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const isDarkMode = ref(false)
const chatSubTab = ref('chat')
const chatInputMessage = ref('')
const inputHeight = ref(80)
const isInputResizing = ref(false)
const inputStartY = ref(0)
const inputStartHeight = ref(0)

// Constants
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_RATIO = 0.6

// Tab configuration with Bootstrap Icons
const tabs = [
  { id: 'tool', label: '工具', icon: 'bi bi-wrench' },
  { id: 'bookmarks', label: '書籤', icon: 'bi bi-bookmark-star' },
  { id: 'dictionary', label: '法規搜尋', icon: 'bi bi-book' },

  { id: 'chat', label: 'AI 助手', icon: 'bi bi-robot' }
]

// Computed styles for split view
const panelStyle = computed(() => ({
  width: `${props.width}px`
}))

const dividerStyle = computed(() => ({
  right: `${props.width}px`
}))

// Theme storage key - must match ThemeManager in extension
const THEME_STORAGE_KEY = 'precedent-theme'

/**
 * Toggle dark/light theme - syncs with popup and all components
 */
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  const themeValue = isDarkMode.value ? 'dark' : 'light'
  
  // Save to storage (this broadcasts to other contexts via storage.onChanged)
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: themeValue })
    }
    localStorage.setItem(THEME_STORAGE_KEY, themeValue)
  } catch (e) {
    console.warn('[Sidebar] Failed to save theme:', e)
  }
  
  // Apply locally
  applyThemeToDocument(isDarkMode.value)
  
  // Dispatch event for sibling components on same page
  window.dispatchEvent(new CustomEvent('themeChanged', { 
    detail: { theme: themeValue, setting: themeValue } 
  }))
  
  console.log('[Sidebar] Theme toggled to:', themeValue)
}

/**
 * Apply theme to document
 */
function applyThemeToDocument(dark) {
  const html = document.documentElement
  const body = document.body
  
  if (dark) {
    html.setAttribute('data-bs-theme', 'dark')
    html.classList.add('dark')
    body?.setAttribute('data-bs-theme', 'dark')
    body?.classList.add('dark')
  } else {
    html.removeAttribute('data-bs-theme')
    html.classList.remove('dark')
    body?.removeAttribute('data-bs-theme')
    body?.classList.remove('dark')
  }
}

/**
 * Load saved theme preference and setup listeners for sync
 */
async function loadThemePreference() {
  try {
    let savedTheme = null
    
    // Try chrome.storage first
    if (typeof chrome !== 'undefined' && chrome.storage) {
      savedTheme = await new Promise((resolve) => {
        chrome.storage.local.get([THEME_STORAGE_KEY], (res) => {
          resolve(res[THEME_STORAGE_KEY])
        })
      })
    }
    
    // Fallback to localStorage
    if (!savedTheme) {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    }
    
    // Determine effective theme
    if (savedTheme === 'dark') {
      isDarkMode.value = true
    } else if (savedTheme === 'light') {
      isDarkMode.value = false
    } else {
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    applyThemeToDocument(isDarkMode.value)
    
    // Listen for chrome.storage changes (from popup or other tabs)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[THEME_STORAGE_KEY]) {
          const newTheme = changes[THEME_STORAGE_KEY].newValue
          console.log('[Sidebar] Storage theme changed:', newTheme)
          isDarkMode.value = newTheme === 'dark'
          applyThemeToDocument(isDarkMode.value)
        }
      })
    }
    
    // Listen for runtime messages (from popup)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'THEME_CHANGED') {
          console.log('[Sidebar] Theme message received:', message.theme)
          isDarkMode.value = message.effectiveTheme === 'dark' || message.theme === 'dark'
          applyThemeToDocument(isDarkMode.value)
          sendResponse({ success: true })
        }
      })
    }
    
    // Listen for themeChanged events (from same page components)
    window.addEventListener('themeChanged', (e) => {
      const newTheme = e.detail?.theme
      if (newTheme) {
        isDarkMode.value = newTheme === 'dark'
        applyThemeToDocument(isDarkMode.value)
      }
    })
    
    // Listen for localStorage changes (cross-tab sync for non-extension)
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        isDarkMode.value = e.newValue === 'dark'
        applyThemeToDocument(isDarkMode.value)
      }
    })
    
    // Watch system preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
      let savedPref = null
      if (typeof chrome !== 'undefined' && chrome.storage) {
        savedPref = await new Promise((resolve) => {
          chrome.storage.local.get([THEME_STORAGE_KEY], (res) => resolve(res[THEME_STORAGE_KEY]))
        })
      }
      if (!savedPref) savedPref = localStorage.getItem(THEME_STORAGE_KEY)
      
      if (!savedPref || savedPref === 'system') {
        isDarkMode.value = e.matches
        applyThemeToDocument(isDarkMode.value)
      }
    })
    
    console.log('[Sidebar] Theme loaded:', isDarkMode.value ? 'dark' : 'light')
  } catch (e) {
    console.warn('[Sidebar] Failed to load theme:', e)
  }
}

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



// Chat functions
async function handleSendMessage() {
  if (!chatInputMessage.value.trim() || chatStore.isLoading) return
  
  const message = chatInputMessage.value.trim()
  chatInputMessage.value = ''
  
  await chatStore.sendMessage(message)
  
  nextTick(() => {
    scrollToBottom()
  })
}

function useExamplePrompt(prompt) {
  chatInputMessage.value = prompt
  handleSendMessage()
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function insertNewline() {
  const textarea = chatInputRef.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = chatInputMessage.value
  chatInputMessage.value = value.substring(0, start) + '\n' + value.substring(end)
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 1
  })
}

function formatMessage(text = '') {
  return text.replace(/\n/g, '<br>')
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return formatMessage(text)
  return formatMessage(text.substring(0, maxLength) + '...')
}

function reuseHistory(item) {
  chatInputMessage.value = item.message || ''
  chatSubTab.value = 'chat'
  nextTick(() => {
    chatInputRef.value?.focus()
  })
}

function editHistory(item) {
  chatInputMessage.value = (item.message || '') + '\n\n[Additional context]: '
  chatSubTab.value = 'chat'
  nextTick(() => {
    if (chatInputRef.value) {
      chatInputRef.value.focus()
      const length = chatInputMessage.value.length
      chatInputRef.value.setSelectionRange(length, length)
    }
  })
}

function startNewChat() {
  chatStore.createNewConversation()
  chatSubTab.value = 'chat'
}

// Input resize functions
function startInputResize(e) {
  isInputResizing.value = true
  inputStartY.value = e.touches ? e.touches[0].clientY : e.clientY
  inputStartHeight.value = inputHeight.value
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onInputResize)
  document.addEventListener('mouseup', stopInputResize)
  document.addEventListener('touchmove', onInputResize)
  document.addEventListener('touchend', stopInputResize)
}

function onInputResize(e) {
  if (!isInputResizing.value) return
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  const delta = inputStartY.value - clientY
  const newHeight = Math.max(60, Math.min(300, inputStartHeight.value + delta))
  inputHeight.value = newHeight
}

function stopInputResize() {
  isInputResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onInputResize)
  document.removeEventListener('mouseup', stopInputResize)
  document.removeEventListener('touchmove', onInputResize)
  document.removeEventListener('touchend', stopInputResize)
}

// Panel resize functions
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

// Watch for chat messages to auto-scroll
watch(() => chatStore.messages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

watch(() => props.width, () => {
  applySplitView()
})

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  loadThemePreference()
  applySplitView()
  
  // Initialize stores

  await chatStore.initialize()
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
/* Design System Variables - Light Mode */
.tool-panel-split {
  --primary: #476996;
  --primary-hover: #35527a;
  --primary-soft: #EEF2FF;
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --surface: #FFFFFF;
  --surface-muted: #E2E8F0;
  --bg-page: #F8FAFC;
  --border: #CBD5E1;
  --radius: 12px;
  --radius-sm: 8px;
  --success: #22c55e;
  --warning: #f59e0b;
}

/* Dark Mode Variables - Applied when panel has dark-mode class */
.tool-panel-split.dark-mode {
  --primary: #60a5fa;
  --primary-hover: #3b82f6;
  --primary-soft: #1e3a5f;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --surface: #1e293b;
  --surface-muted: #334155;
  --bg-page: #0f172a;
  --border: #475569;
  --success: #4ade80;
  --warning: #fbbf24;
  --destructive: #f87171;
  --destructive-soft: rgba(239, 68, 68, 0.15);
}

/* Dark Mode for Split Divider */
.split-divider.dark-mode {
  --surface-muted: #334155;
  --border: #475569;
  --text-secondary: #94a3b8;
  --primary: #60a5fa;
  background: #1e293b;
}

/* ===== DARK MODE OVERRIDES ===== */
/* Ensure ALL elements properly switch to dark */

/* Tab button active state in dark mode - softer color */
.tool-panel-split.dark-mode .tab-btn.active {
  background: rgba(30, 41, 59, 0.95);
  color: #60a5fa;
}

/* Tab content area - ensure dark background */
/* 使用灰藍色作為外層框架，匹配左側瀏覽器模式 */
.tool-panel-split.dark-mode .tab-content-area {
  background: #1e293b;
}

/* Tab content inner - the main content box */
.tool-panel-split.dark-mode .tab-content-inner {
  background: #0f172a;
  border-color: #334155;
}

/* Chat container dark mode */
.tool-panel-split.dark-mode .chat-container {
  background: #1e293b;
}

.tool-panel-split.dark-mode .chat-tabs {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .chat-messages {
  background: #0f172a;
}

.tool-panel-split.dark-mode .chat-input-container {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .chat-input {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .chat-input::placeholder {
  color: #64748b;
}

/* Message bubbles in dark mode */
.tool-panel-split.dark-mode .message.assistant .message-content {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .message.user .message-content {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
}

/* History panel dark mode */
.tool-panel-split.dark-mode .history-panel {
  background: #0f172a;
}

.tool-panel-split.dark-mode .history-item {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .btn-refresh {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .btn-refresh:hover {
  background: #334155;
}

/* Flashcard stats dark mode */
.tool-panel-split.dark-mode .stat-card {
  background: #334155;
}

.tool-panel-split.dark-mode .stat-card.due {
  background: rgba(251, 191, 36, 0.15);
}

.tool-panel-split.dark-mode .stat-card.mastered {
  background: rgba(74, 222, 128, 0.15);
}

/* Mode toggle dark mode */
.tool-panel-split.dark-mode .mode-toggle {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .mode-btn {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .mode-btn:hover {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.tool-panel-split.dark-mode .mode-btn.active {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
  color: #f1f5f9;
}

/* Welcome message dark mode */
.tool-panel-split.dark-mode .welcome-message {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .welcome-message h3 {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .welcome-message i {
  color: #60a5fa;
}

/* Example prompts dark mode */
.tool-panel-split.dark-mode .example-prompts button {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .example-prompts button:hover {
  background: rgba(96, 165, 250, 0.15);
  border-color: #60a5fa;
  color: #60a5fa;
}

/* Server status dark mode */
.tool-panel-split.dark-mode .server-status-banner.checking {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.2), rgba(59, 130, 246, 0.15));
}

.tool-panel-split.dark-mode .server-status-banner.offline {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.15));
}

/* Scrollbar dark mode */
.tool-panel-split.dark-mode .tab-content-inner::-webkit-scrollbar-track,
.tool-panel-split.dark-mode .chat-messages::-webkit-scrollbar-track,
.tool-panel-split.dark-mode .history-list::-webkit-scrollbar-track {
  background: #1e293b;
}

.tool-panel-split.dark-mode .tab-content-inner::-webkit-scrollbar-thumb,
.tool-panel-split.dark-mode .chat-messages::-webkit-scrollbar-thumb,
.tool-panel-split.dark-mode .history-list::-webkit-scrollbar-thumb {
  background: #475569;
}

.tool-panel-split.dark-mode .tab-content-inner::-webkit-scrollbar-thumb:hover,
.tool-panel-split.dark-mode .chat-messages::-webkit-scrollbar-thumb:hover,
.tool-panel-split.dark-mode .history-list::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* ===== DICTIONARY CONTENT DARK MODE ===== */
.tool-panel-split.dark-mode .dictionary-container {
  background: #1e293b;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .dictionary-search-container {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
  border-color: #334155;
}

.tool-panel-split.dark-mode .search-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .search-title i {
  color: #60a5fa;
  margin-right: 8px;
}

.tool-panel-split.dark-mode .quick-access-panel {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
  border-color: #78350f;
}

.tool-panel-split.dark-mode .quick-access-title i {
  color: #fbbf24;
  margin-right: 6px;
}

.tool-panel-split.dark-mode .category-section {
  background: #0f172a;
  border-color: #334155;
}

.tool-panel-split.dark-mode .category-title i {
  color: #60a5fa;
  margin-right: 8px;
}

.tool-panel-split.dark-mode .section-title i {
  color: #60a5fa;
  margin-right: 8px;
}

.tool-panel-split.dark-mode .dictionary-search-input {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .dictionary-search-input::placeholder {
  color: #64748b;
}

.tool-panel-split.dark-mode .dictionary-search-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
}

.tool-panel-split.dark-mode .dictionary-search-btn {
  background: #60a5fa;
}

.tool-panel-split.dark-mode .dictionary-search-btn:hover:not(:disabled) {
  background: #3b82f6;
}

.tool-panel-split.dark-mode .search-hint {
  background: rgba(30, 58, 95, 0.5);
  color: #94a3b8;
}

.tool-panel-split.dark-mode .quick-access-panel {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  border-color: #78350f;
}

.tool-panel-split.dark-mode .quick-access-title {
  color: #fbbf24;
}

.tool-panel-split.dark-mode .recent-search-tag {
  background: #1e293b;
  border-color: #78350f;
  color: #fbbf24;
}

.tool-panel-split.dark-mode .recent-search-tag:hover {
  background: rgba(251, 191, 36, 0.15);
}

.tool-panel-split.dark-mode .results-header {
  background: rgba(96, 165, 250, 0.1);
  border-color: #1e3a5f;
}

.tool-panel-split.dark-mode .results-title {
  color: #60a5fa;
}

.tool-panel-split.dark-mode .clear-results-btn {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .clear-results-btn:hover {
  border-color: #60a5fa;
  color: #60a5fa;
}

.tool-panel-split.dark-mode .result-item {
  background: #0f172a;
  border-color: #334155;
}

.tool-panel-split.dark-mode .result-item:hover {
  border-color: #60a5fa;
  background: #1e293b;
}

.tool-panel-split.dark-mode .result-title {
  color: #60a5fa;
}

.tool-panel-split.dark-mode .result-preview {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .result-source {
  color: #64748b;
}

.tool-panel-split.dark-mode .law-categories {
  background: transparent;
}

.tool-panel-split.dark-mode .category-section {
  background: #0f172a;
  border-color: #334155;
}

.tool-panel-split.dark-mode .category-section:hover {
  border-color: #60a5fa;
  background: #1e293b;
}

.tool-panel-split.dark-mode .category-title {
  color: #60a5fa;
}

.tool-panel-split.dark-mode .law-link {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .law-link:hover {
  border-color: #60a5fa;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

/* ===== BOOKMARKS CONTENT DARK MODE ===== */
.tool-panel-split.dark-mode .bookmark-content,
.tool-panel-split.dark-mode .active-bookmark-content {
  background: #1e293b;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .content-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
  border-color: #334155;
}

.tool-panel-split.dark-mode .section-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .header-actions {
  background: transparent;
}

.tool-panel-split.dark-mode .header-actions .action-btn {
  background: rgba(96, 165, 250, 0.15);
  border-color: #60a5fa;
  color: #60a5fa;
}

.tool-panel-split.dark-mode .header-actions .action-btn:hover {
  background: rgba(96, 165, 250, 0.25);
  border-color: #93c5fd;
}

.tool-panel-split.dark-mode .bookmark-item {
  background: #0f172a;
  border-color: #334155;
}

.tool-panel-split.dark-mode .bookmark-item:hover {
  border-color: #60a5fa;
  background: #1e293b;
}

.tool-panel-split.dark-mode .bookmark-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .bookmark-meta {
  color: #64748b;
}

.tool-panel-split.dark-mode .bookmark-preview {
  color: #94a3b8;
  background: transparent;
}

.tool-panel-split.dark-mode .bookmark-actions button {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .bookmark-actions button:hover {
  background: #334155;
  border-color: #60a5fa;
}

.tool-panel-split.dark-mode .empty-state {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .empty-icon {
  color: #64748b;
}

.tool-panel-split.dark-mode .empty-icon i {
  color: #64748b;
}

.tool-panel-split.dark-mode .empty-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .empty-subtitle {
  color: #64748b;
}

.tool-panel-split.dark-mode .loading-state {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .spinner {
  border-color: #334155;
  border-top-color: #60a5fa;
}

.tool-panel-split.dark-mode .edit-modal {
  background: rgba(0, 0, 0, 0.7);
}

.tool-panel-split.dark-mode .edit-dialog {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .edit-header {
  border-color: #334155;
}

.tool-panel-split.dark-mode .edit-header h4 {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .close-btn {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .close-btn:hover {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .edit-body {
  background: #1e293b;
}

.tool-panel-split.dark-mode .form-group label {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .form-control {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .form-control:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

.tool-panel-split.dark-mode .form-control::placeholder {
  color: #64748b;
}

.tool-panel-split.dark-mode .edit-footer {
  border-color: #334155;
}

.tool-panel-split.dark-mode .btn-secondary {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .btn-secondary:hover {
  background: #334155;
  border-color: #60a5fa;
}

.tool-panel-split.dark-mode .btn-primary {
  background: #60a5fa;
  border-color: #60a5fa;
  color: #0f172a;
}

.tool-panel-split.dark-mode .btn-primary:hover {
  background: #3b82f6;
  border-color: #3b82f6;
}

/* Deep content styles for ToolContent */
.tool-panel-split.dark-mode :deep(.interpretation-section) {
  background: #1e293b;
  border-left-color: #a78bfa;
}

.tool-panel-split.dark-mode :deep(.interpretation-section h4) {
  color: #a78bfa;
}

.tool-panel-split.dark-mode :deep(.interpretation-section p) {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode :deep(.law-header) {
  /* 移除漸變背景，使用透明背景以匹配父容器 */
  background: transparent;
  border-left-color: #60a5fa;
}

.tool-panel-split.dark-mode :deep(.law-header h3) {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode :deep(.last-amended) {
  color: #94a3b8;
}

.tool-panel-split.dark-mode :deep(.law-article) {
  /* 移除孤立背景，使用透明背景以匹配父容器，消除視覺分離 */
  background: transparent;
  border-left-color: #4ade80;
}

.tool-panel-split.dark-mode :deep(.article-number) {
  color: #4ade80;
}

.tool-panel-split.dark-mode :deep(.article-caption) {
  color: #60a5fa;
}

.tool-panel-split.dark-mode :deep(.article-content) {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode :deep(.error-message) {
  background: rgba(239, 68, 68, 0.15);
  border-color: #f87171;
  color: #f87171;
}

.tool-panel-split.dark-mode :deep(.english-section) {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
  border-left-color: #60a5fa;
}

.tool-panel-split.dark-mode :deep(.english-section h4) {
  color: #60a5fa;
}

.tool-panel-split.dark-mode :deep(.highlight-section) {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  border-left-color: #fbbf24;
}

.tool-panel-split.dark-mode :deep(.highlight-section h4) {
  color: #fbbf24;
}

/* ===== TOOL CONTENT DARK MODE ===== */
.tool-panel-split.dark-mode .tool-content {
  /* 移除灰藍色背景，使用透明背景以與父容器 tab-content-inner 融合，消除視覺分離 */
  background: transparent;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .content-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
  border-left-color: #60a5fa;
}

.tool-panel-split.dark-mode .content-title {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode .content-meta {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .main-content,
.tool-panel-split.dark-mode #tool-main-content {
  background: #0f172a !important;
  border-color: #334155;
  color: #e2e8f0;
}

/* Ensure main-content children also have dark backgrounds - 使用較柔和的灰色而非純白 */
.tool-panel-split.dark-mode .main-content *,
.tool-panel-split.dark-mode #tool-main-content * {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode .main-content p,
.tool-panel-split.dark-mode #tool-main-content p {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode .main-content h1,
.tool-panel-split.dark-mode .main-content h2,
.tool-panel-split.dark-mode .main-content h3,
.tool-panel-split.dark-mode .main-content h4,
.tool-panel-split.dark-mode #tool-main-content h1,
.tool-panel-split.dark-mode #tool-main-content h2,
.tool-panel-split.dark-mode #tool-main-content h3,
.tool-panel-split.dark-mode #tool-main-content h4 {
  color: #e2e8f0;
}

.tool-panel-split.dark-mode .content-meta i {
  color: #60a5fa;
  margin-right: 4px;
}

.tool-panel-split.dark-mode .action-area {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .action-area .action-btn {
  background: #0f172a;
  border-color: #334155;
  color: #e2e8f0;
}

.tool-panel-split.dark-mode .action-area .action-btn:hover {
  background: #334155;
  border-color: #60a5fa;
}

.tool-panel-split.dark-mode .action-area .bookmark-btn {
  border-color: #4ade80;
  color: #4ade80;
}

.tool-panel-split.dark-mode .action-area .bookmark-btn:hover {
  background: rgba(74, 222, 128, 0.15);
}

.tool-panel-split.dark-mode .action-area .link-btn {
  border-color: #60a5fa;
  color: #60a5fa;
}

.tool-panel-split.dark-mode .action-area .link-btn:hover {
  background: rgba(96, 165, 250, 0.15);
}

.tool-panel-split.dark-mode .action-area .share-btn {
  border-color: #a78bfa;
  color: #a78bfa;
}

.tool-panel-split.dark-mode .action-area .share-btn:hover {
  background: rgba(167, 139, 250, 0.15);
}

.tool-panel-split.dark-mode .empty-state {
  color: #94a3b8;
}

.tool-panel-split.dark-mode .empty-icon {
  color: #64748b;
}

.tool-panel-split.dark-mode .empty-icon i {
  color: #64748b;
}

.tool-panel-split.dark-mode .empty-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .empty-subtitle {
  color: #64748b;
}

.tool-panel-split.dark-mode .tool-section {
  background: #0f172a;
  border-color: #334155;
}

.tool-panel-split.dark-mode .tool-section-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .tool-item {
  background: #1e293b;
  border-color: #334155;
}

.tool-panel-split.dark-mode .tool-item:hover {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.tool-panel-split.dark-mode .tool-item-title {
  color: #f1f5f9;
}

.tool-panel-split.dark-mode .tool-item-desc {
  color: #94a3b8;
}

/* ===== GENERIC DARK MODE FOR ALL CONTENT ===== */
.tool-panel-split.dark-mode input,
.tool-panel-split.dark-mode textarea,
.tool-panel-split.dark-mode select {
  background: #0f172a;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode input::placeholder,
.tool-panel-split.dark-mode textarea::placeholder {
  color: #64748b;
}

.tool-panel-split.dark-mode input:focus,
.tool-panel-split.dark-mode textarea:focus,
.tool-panel-split.dark-mode select:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
}

.tool-panel-split.dark-mode button:not(.tab-btn):not(.header-btn):not(.close-btn):not(.mode-btn):not(.chat-tabs button):not(.btn-send) {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.tool-panel-split.dark-mode button:not(.tab-btn):not(.header-btn):not(.close-btn):not(.mode-btn):not(.chat-tabs button):not(.btn-send):hover {
  background: #334155;
  border-color: #60a5fa;
}

/* Split View Divider */
.split-divider {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 8px;
  background: var(--surface-muted);
  cursor: col-resize;
  z-index: 2147483648;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.split-divider:hover,
.split-divider:active {
  background: var(--border);
}

.divider-handle {
  width: 4px;
  height: 48px;
  background: var(--text-secondary);
  border-radius: 2px;
  transition: background 0.2s, height 0.2s;
}

.split-divider:hover .divider-handle,
.split-divider:active .divider-handle {
  background: var(--primary);
  height: 64px;
}

/* Split View Panel */
.tool-panel-split {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  background: var(--surface);
  font-family: "Inter", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  z-index: 2147483647;
  box-shadow: -2px 0 12px rgba(15, 23, 42, 0.1);
}

.panel-header {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: white;
  padding: 16px;
  flex-shrink: 0;
}

/* Dark mode header - softer, more eye-friendly colors */
.tool-panel-split.dark-mode .panel-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Dark mode for header actions */
.tool-panel-split.dark-mode .header-actions {
  background: transparent;
}

.header-btn {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 32px;
  height: 32px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.tab-navigation {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-btn i {
  font-size: 13px;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary);
  font-weight: 600;
  border-color: transparent;
}

.tab-content-area {
  flex: 1;
  overflow: hidden;
  background: var(--bg-page);
}

.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content-inner {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  /* 使用更柔和的背景色以減少長時間閱讀的疲勞 */
  background: #FAFBFC;
  margin: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.tab-content-inner::-webkit-scrollbar {
  width: 6px;
}

.tab-content-inner::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: 3px;
}

.tab-content-inner::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.tab-content-inner::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Flashcard Stats */
.flashcard-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  background: var(--surface-muted);
  padding: 12px;
  border-radius: var(--radius-sm);
  text-align: center;
}

.stat-card.due {
  background: rgba(245, 158, 11, 0.1);
}

.stat-card.mastered {
  background: rgba(34, 197, 94, 0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-card.due .stat-value {
  color: var(--warning);
}

.stat-card.mastered .stat-value {
  color: var(--success);
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Flashcard Styles */
.flashcard-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mode-toggle {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px;
  margin-bottom: 16px;
}

.mode-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
}

.mode-btn:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.mode-btn.active {
  background: var(--primary);
  color: white;
}

.mode-content {
  flex: 1;
  overflow-y: auto;
}

/* Chat Container */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
}

.chat-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.chat-tabs button {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: inherit;
}

.chat-tabs button.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}

.chat-tabs button:hover:not(.active) {
  background: var(--surface-muted);
}

/* Chat Panel */
.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--bg-page);
}

.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.welcome-message i {
  font-size: 48px;
  color: var(--primary);
  margin-bottom: 16px;
  opacity: 0.8;
}

.welcome-message h3 {
  margin: 0 0 8px;
  color: var(--text-primary);
  font-size: 18px;
}

.welcome-message p {
  margin: 0;
  font-size: 14px;
}

/* Example Prompts */
.example-prompts {
  margin-top: 20px;
  width: 100%;
  max-width: 300px;
}

.example-prompts .prompts-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.example-prompts button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.example-prompts button:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

/* Server Status Banner */
.server-status-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
  border-radius: 8px;
  font-size: 13px;
}

.server-status-banner.checking {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.1));
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.server-status-banner.offline {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.server-status-banner i {
  font-size: 16px;
}

.server-status-banner .retry-btn {
  margin-left: auto;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.server-status-banner .retry-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.message {
  display: flex;
  gap: 12px;
  max-width: 90%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
}

.message.user .message-avatar {
  background: var(--primary);
  color: white;
}

.message.assistant .message-avatar {
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.message-content {
  padding: 12px 16px;
  border-radius: 16px;
  position: relative;
  font-size: 14px;
  line-height: 1.6;
}

.message.user .message-content {
  background: var(--primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.message-text {
  word-wrap: break-word;
}

.message-time {
  font-size: 10px;
  opacity: 0.7;
  margin-top: 6px;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
  opacity: 0.5;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-8px);
    opacity: 1;
  }
}

.error-message {
  padding: 12px 16px;
  background: var(--destructive-soft, #fef2f2);
  color: var(--destructive, #dc2626);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

/* Dark mode for error message */
.tool-panel-split.dark-mode .error-message {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Chat Input */
.chat-input-container {
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  position: relative;
}

.resize-handle-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 2;
}

.resize-handle-top:hover {
  background: linear-gradient(180deg, rgba(71, 105, 150, 0.15), transparent);
}

.resize-handle-top::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  transition: background 0.2s;
}

.resize-handle-top:hover::after {
  background: var(--primary);
}

.chat-input {
  flex: 1;
  width: 100%;
  padding: 12px;
  padding-right: 56px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: var(--surface);
  color: var(--text-primary);
}

.chat-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.chat-input:disabled {
  background: var(--surface-muted);
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-send {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 8px rgba(71, 105, 150, 0.3);
}

.btn-send:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.05);
}

.btn-send:disabled {
  background: var(--border);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* History Panel */
.history-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  background: var(--bg-page);
  min-height: 0;
  overflow: hidden;
}

.history-toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-refresh,
.btn-new-chat {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-refresh:hover,
.btn-new-chat:hover {
  background: var(--surface-muted);
}

.btn-new-chat {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-new-chat:hover {
  background: var(--primary-hover);
}

.history-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  padding: 40px 0;
  font-size: 14px;
}

.history-placeholder i {
  font-size: 32px;
  opacity: 0.5;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.history-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px;
  background: var(--surface);
}

.history-question,
.history-answer {
  display: flex;
  gap: 8px;
  line-height: 1.5;
  color: var(--text-primary);
  font-size: 13px;
}

.history-question strong,
.history-answer strong {
  color: var(--primary);
  flex-shrink: 0;
}

.history-answer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.history-meta {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 10px;
}

.history-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.history-reuse,
.history-edit {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: inherit;
}

.history-reuse {
  background: var(--primary);
  color: white;
}

.history-reuse:hover {
  background: var(--primary-hover);
}

.history-edit {
  background: var(--surface-muted);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.history-edit:hover {
  background: var(--border);
}

/* Scrollbar styles */
.chat-messages::-webkit-scrollbar,
.history-list::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track,
.history-list::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb,
.history-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover,
.history-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
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

  .tab-btn span {
    display: none;
  }

  .tab-btn {
    padding: 8px 10px;
  }

  .flashcard-stats {
    gap: 8px;
  }

  .stat-card {
    padding: 8px;
  }

  .stat-value {
    font-size: 20px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .split-divider,
  .divider-handle,
  .tab-btn,
  .mode-btn,
  .close-btn,
  .header-btn,
  .btn-send,
  .typing span {
    transition: none;
    animation: none;
  }
}
</style>
