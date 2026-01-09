import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { openaiService } from '../services/openaiService'

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref([])
  const historyItems = ref([])
  const conversations = ref([]) // Local conversation list
  const currentConversationId = ref(null)
  const isLoading = ref(false)
  const isHistoryLoading = ref(false)
  const errorMessage = ref('')
  const isOnline = ref(true)
  const serverStatus = ref('checking') // 'online', 'offline', 'checking'

  // Computed
  const hasMessages = computed(() => messages.value.length > 0)
  const hasHistory = computed(() => historyItems.value.length > 0)

  // Initialize
  async function initialize() {
    console.log('[Chat] Initializing AI Chat via Backend Server')
    loadLocalConversations()

    // Check server status
    await checkServerStatus()

    // If we have conversations, load the last one
    if (conversations.value.length > 0) {
      // Use the most recent conversation
      currentConversationId.value = conversations.value[0].id
      loadConversationMessages(currentConversationId.value)
    } else {
      // Create a default new conversation if none exist
      createNewConversation()
    }
  }

  // Check if the backend server is running
  async function checkServerStatus() {
    serverStatus.value = 'checking'
    try {
      const response = await fetch('http://localhost:3000/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        serverStatus.value = 'online'
        isOnline.value = true
        console.log('[Chat] Backend server is online')
      } else {
        serverStatus.value = 'offline'
        isOnline.value = false
        console.warn('[Chat] Backend server responded with error')
      }
    } catch (err) {
      serverStatus.value = 'offline'
      isOnline.value = false
      console.warn('[Chat] Backend server is offline:', err.message)
    }
    return serverStatus.value === 'online'
  }

  // Local Storage Management
  function loadLocalConversations() {
    try {
      const saved = localStorage.getItem('precedent_chat_conversations')
      if (saved) {
        conversations.value = JSON.parse(saved)
      }
    } catch (err) {
      console.error('[Chat] Error loading conversations:', err)
    }
  }

  function saveLocalConversations() {
    localStorage.setItem('precedent_chat_conversations', JSON.stringify(conversations.value))
  }

  function loadConversationMessages(id) {
    try {
      const saved = localStorage.getItem(`precedent_chat_${id}`)
      if (saved) {
        messages.value = JSON.parse(saved)
      } else {
        messages.value = []
      }
    } catch (err) {
      console.error('[Chat] Error loading messages:', err)
      messages.value = []
    }
  }

  function saveConversationMessages(id, msgs) {
    if (!id) return
    localStorage.setItem(`precedent_chat_${id}`, JSON.stringify(msgs))
    // Also update history items logic if needed, but for now messages array is what we render
  }

  // Send a message
  async function sendMessage(content) {
    if (!content.trim()) return

    // Check server status first
    if (serverStatus.value !== 'online') {
      const isUp = await checkServerStatus()
      if (!isUp) {
        errorMessage.value = 'AI 伺服器未連線。請確認伺服器正在運行 (npm run server)'
        return
      }
    }

    // Ensure we have a conversation
    if (!currentConversationId.value) {
      createNewConversation()
    }

    const userMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    }

    // Optimistic UI update
    messages.value.push(userMessage)
    saveConversationMessages(currentConversationId.value, messages.value)

    isLoading.value = true
    errorMessage.value = ''

    try {
      // Prepare context for API (last 10 messages to save tokens)
      const context = messages.value.slice(0, -1).slice(-10)

      const responseContent = await openaiService.sendMessage(content.trim(), context)

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString()
      }
      messages.value.push(assistantMessage)

      // Save
      saveConversationMessages(currentConversationId.value, messages.value)

      // Update conversation timestamp/preview
      updateConversationMeta(currentConversationId.value, content.trim())

    } catch (err) {
      console.error('[Chat] Send error:', err)
      
      // Provide user-friendly error messages
      let userError = err.message || 'Failed to get response from AI'
      if (userError.includes('fetch') || userError.includes('network') || userError.includes('Failed to fetch')) {
        userError = 'AI 伺服器未連線。請確認伺服器正在運行。'
        serverStatus.value = 'offline'
      } else if (userError.includes('API key')) {
        userError = 'OpenAI API 金鑰未設定。請檢查 server/.env 檔案。'
      }
      
      errorMessage.value = userError

      messages.value.push({
        role: 'assistant',
        content: `錯誤：${userError}`,
        timestamp: new Date().toISOString(),
        isError: true
      })
    } finally {
      isLoading.value = false
    }
  }

  function updateConversationMeta(id, lastMessage) {
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      conversations.value[idx].updatedAt = new Date().toISOString()
      conversations.value[idx].preview = lastMessage.substring(0, 50) + '...'
      // Move to top
      const conv = conversations.value.splice(idx, 1)[0]
      conversations.value.unshift(conv)
      saveLocalConversations()
    }
  }

  // Actions
  function clearMessages() {
    messages.value = []
    if (currentConversationId.value) {
      saveConversationMessages(currentConversationId.value, [])
    }
  }

  function clearError() {
    errorMessage.value = ''
  }

  function refreshHistory() {
    loadLocalConversations()
  }

  function createNewConversation(title = 'New Chat') {
    const id = `chat_${Date.now()}`
    const newConv = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview: 'Start a new conversation...'
    }
    conversations.value.unshift(newConv)
    saveLocalConversations()

    currentConversationId.value = id
    messages.value = []
    saveConversationMessages(id, [])
  }

  function deleteConversation(id) {
    conversations.value = conversations.value.filter(c => c.id !== id)
    localStorage.removeItem(`precedent_chat_${id}`)
    saveLocalConversations()

    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        currentConversationId.value = conversations.value[0].id
        loadConversationMessages(currentConversationId.value)
      } else {
        createNewConversation()
      }
    }
  }

  function switchConversation(id) {
    if (currentConversationId.value === id) return
    currentConversationId.value = id
    loadConversationMessages(id)
  }

  // Stub for history items (compatibility with existing UI)
  watch(messages, () => {
    historyItems.value = messages.value.map((msg, idx) => ({
      id: idx,
      message: msg.role === 'user' ? msg.content : '',
      response: msg.role === 'assistant' ? msg.content : '',
      created_at: msg.timestamp
    })).filter(item => item.message || item.response)
  }, { deep: true })

  // Re-map messages to history format expected by UI if necessary
  // The current UI iterates over chatStore.messages for the valid chat view
  // and historyItems for the "history" tab. 
  // We need to ensure historyItems is populated if we want the history tab to work.
  // Actually, MainSidebar.vue uses `chatStore.historyItems` which seems to be a list of distinct Q&A pairs.
  // Converting a linear chat stream to Q&A pairs is tricky. 
  // For now, let's keep historyItems as an array of conversations for the "history tab" list 
  // OR simply let the history tab show the list of conversations?
  // Looking at MainSidebar.vue:
  // It iterates `chatStore.historyItems` and shows `item.message` and `item.response`.
  // This implies the history tab is a list of "QA pairs" not "Conversations".
  // BUT `chat.js` original code had `historyItems` as the conversation history.
  // The user wanted "users can easily navigate their past history".
  // Standard ChatGPT style is a list of Conversations on the side. 
  // The existing UI has a "History" sub-tab in the panel.
  // Let's map the *conversations* to `historyItems` so the user can switch between them?
  // No, `MainSidebar.vue` expects `item.message` and `item.response`.
  // Let's stick to the current chat view being the main interaction.
  // The "History" tab in the current UI seems to be a list of Q&A from the *current* conversation 
  // OR a list of past query/response pairs (log style).
  // Given `MainSidebar.vue` logic: `reuseHistory` sets input to `item.message`.
  // I will compute `historyItems` from `messages` as pairs of (User, Assistant) for the current conversation.

  const computedHistory = computed(() => {
    const items = []
    let currentQ = null

    messages.value.forEach((msg, idx) => {
      if (msg.role === 'user') {
        currentQ = {
          id: idx,
          message: msg.content,
          response: null,
          created_at: msg.timestamp
        }
        items.unshift(currentQ) // Newest first
      } else if (msg.role === 'assistant' && currentQ) {
        currentQ.response = msg.content
        currentQ = null
      } else if (msg.role === 'assistant' && !currentQ) {
        // Orphan assistant message
        items.unshift({
          id: idx,
          message: '(Conversation continued...)',
          response: msg.content,
          created_at: msg.timestamp
        })
      }
    })
    return items
  })

  // Watcher to sync computed history to ref (since the UI might expect a ref array)
  watch(computedHistory, (val) => {
    historyItems.value = val
  }, { immediate: true })


  return {
    // State
    messages,
    historyItems,
    conversations,
    currentConversationId,
    isLoading,
    isHistoryLoading,
    errorMessage,
    isOnline,
    serverStatus,

    // Computed
    hasMessages,
    hasHistory,

    // Actions
    initialize,
    checkServerStatus,
    sendMessage,
    clearMessages,
    clearError,
    refreshHistory,
    createNewConversation,
    deleteConversation,
    switchConversation,
    loadConversationHistory: loadConversationMessages // Alias
  }
})
