<template>
  <div class="side-panel-app" :class="{ 'dark-mode': isDarkMode }">
    <!-- Navbar -->
    <nav class="panel-nav">
      <div class="nav-tabs-container">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="nav-btn"
          :class="{ active: currentTab === tab.id }"
          @click="currentTab = tab.id"
        >
          <i :class="tab.icon"></i>
          <span>{{ tab.label }}</span>
        </button>
      </div>
      <div class="nav-controls">
        <div 
          class="auth-badge" 
          :class="{ authenticated: isAuthenticated }"
          :title="isAuthenticated ? `已登入: ${username}` : '點擊登入'"
          @click="handleAuthClick"
        >
          <i class="bi bi-person-circle"></i>
        </div>
        <button class="btn-header" @click="toggleTheme" title="切換主題">
          <i :class="isDarkMode ? 'bi bi-sun-fill' : 'bi bi-moon-fill'"></i>
        </button>
      </div>
    </nav>

    <!-- Content Area -->
    <main class="panel-content">
      <!-- Chat Tab (To be implemented fully, placeholder for now) -->
      <div v-show="currentTab === 'ai'" class="tab-panel">
        <div class="login-required" v-if="!isAuthenticated">
          <div class="login-icon">
            <i class="bi bi-shield-lock"></i>
          </div>
          <h2 class="login-title">請先登入</h2>
          <p class="login-description">
            登入 ExamQuestionBank 以使用 AI 法律助手功能。<br>
            您的對話記錄將自動同步至雲端。
          </p>
          <button class="btn-login" @click="openLogin">
            <i class="bi bi-box-arrow-in-right"></i>
            登入 Google 帳號
          </button>
        </div>
        <div v-else class="chat-wrapper">
          <ChatPanel :user-id="userId" />
        </div>
      </div>

      <!-- Notes Tab -->
      <div v-show="currentTab === 'notes'" class="tab-panel active-tab">
        <NotePanel />
      </div>

      <!-- Search Tab -->
      <div v-show="currentTab === 'search'" class="tab-panel">
         <LawSearchPanel />
      </div>
      
       <!-- Bookmarks Tab -->
       <div v-show="currentTab === 'bookmarks'" class="tab-panel">
          <div class="coming-soon">
             <i class="bi bi-bookmark-star"></i>
             <h3>我的書籤</h3>
             <p>即將推出</p>
         </div>
       </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NotePanel from '../notes/NotePanel.vue'
import ChatPanel from './ChatPanel.vue'
import LawSearchPanel from './LawSearchPanel.vue'
import { useNoteStore } from '../../stores/noteStore'

const currentTab = ref('ai')
const isDarkMode = ref(false)
const isAuthenticated = ref(false)
const username = ref('')
const userId = ref('')

const tabs = [
  { id: 'ai', label: 'AI', icon: 'bi bi-robot' },
  { id: 'notes', label: '筆記', icon: 'bi bi-journal-text' },
  { id: 'search', label: '法規', icon: 'bi bi-search' },
  { id: 'bookmarks', label: '書籤', icon: 'bi bi-bookmark-star' }
]

const THEME_STORAGE_KEY = 'precedent-theme'

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  const theme = isDarkMode.value ? 'dark' : 'light'
  
  // Apply to HTML element for global styles
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-bs-theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-bs-theme')
  }

  chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme })
}

function loadTheme() {
  chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
    isDarkMode.value = result[THEME_STORAGE_KEY] === 'dark'
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-bs-theme', 'dark')
    }
  })
}

function checkAuth() {
  chrome.storage.local.get(['supabaseUserId', 'supabaseDisplayName'], (result) => {
    if (result.supabaseUserId) {
        isAuthenticated.value = true
        userId.value = result.supabaseUserId
        username.value = result.supabaseDisplayName || 'User'
    } else {
        isAuthenticated.value = false
    }
  })
}

function handleAuthClick() {
  if (isAuthenticated.value) {
    if (confirm('確定要登出嗎？')) {
      chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
        checkAuth()
      })
    }
  } else {
    openLogin()
  }
}

function openLogin() {
  chrome.tabs.create({ url: 'http://localhost:5173/login' })
}

// Listen for "Ask AI" from notes
onMounted(() => {
  loadTheme()
  checkAuth()
  
  // Switch to AI tab when "Ask AI" is clicked in notes
  window.addEventListener('ask-ai-note', (e) => {
    currentTab.value = 'ai'
    console.log('Ask AI about note:', e.detail)
    // TODO: Trigger chat with context
  })

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
     if (changes.supabaseUserId) checkAuth()
  })
})
</script>

<style>
/* Global resets for Side Panel */
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  font-family: 'Inter', 'Noto Sans TC', sans-serif;
  background-color: var(--bg-page);
  color: var(--text-primary);
}

#app {
  height: 100%;
}
</style>

<style scoped>
.side-panel-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  box-sizing: border-box;
}

.side-panel-app * {
  box-sizing: border-box;
}

.panel-nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding-right: 8px;
}

.nav-tabs-container {
  display: flex;
  flex: 1;
}

.nav-btn {
  flex: 1;
  padding: 12px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.nav-btn i {
  font-size: 18px;
}

.nav-btn:hover {
  color: var(--primary);
  background: var(--primary-soft);
}

.nav-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--border);
  height: 40px;
}

.btn-header, .auth-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-header:hover, .auth-badge:hover {
  background: var(--surface-muted);
  color: var(--primary);
}

.auth-badge.authenticated {
  color: var(--success, #22c55e);
}

.panel-content {
  flex: 1;
  overflow: hidden; /* Important so NotePanel handles its own scroll */
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
}

.tab-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Coming Soon & Login Placeholders */
.coming-soon, .login-required {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}

.coming-soon i, .login-icon i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
  color: var(--primary);
}

.btn-login {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  margin-top: 16px;
}

.chat-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.chat-placeholder {
  padding: 20px;
  text-align: center;
}
</style>
