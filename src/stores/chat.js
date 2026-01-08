import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/apiService'

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref([])
  const historyItems = ref([])
  const conversations = ref([])
  const currentConversationId = ref(null)
  const isLoading = ref(false)
  const isHistoryLoading = ref(false)
  const errorMessage = ref('')
  const isOnline = ref(false)

  // Computed
  const hasMessages = computed(() => messages.value.length > 0)
  const hasHistory = computed(() => historyItems.value.length > 0)

  // Initialize
  async function initialize() {
    try {
      await apiService.loadTokens()
      isOnline.value = apiService.isAuthenticated()
      
      if (isOnline.value) {
        await loadConversations()
        console.log('[Chat] Initialized with API connection')
      } else {
        // Load from local storage for offline mode
        loadLocalMessages()
        console.log('[Chat] Initialized in offline mode')
      }
    } catch (err) {
      console.warn('[Chat] Initialization error:', err)
      loadLocalMessages()
    }
  }

  // Load local messages from storage
  function loadLocalMessages() {
    try {
      const saved = localStorage.getItem('citeright_chat_messages')
      if (saved) {
        messages.value = JSON.parse(saved)
      }
      const savedHistory = localStorage.getItem('citeright_chat_history')
      if (savedHistory) {
        historyItems.value = JSON.parse(savedHistory)
      }
    } catch (err) {
      console.error('[Chat] Error loading local messages:', err)
    }
  }

  // Save messages to local storage
  function saveLocalMessages() {
    try {
      localStorage.setItem('citeright_chat_messages', JSON.stringify(messages.value))
      localStorage.setItem('citeright_chat_history', JSON.stringify(historyItems.value))
    } catch (err) {
      console.error('[Chat] Error saving local messages:', err)
    }
  }

  // Load conversations from API
  async function loadConversations() {
    try {
      const response = await apiService.getConversations()
      conversations.value = response.results || response || []
      
      // Set current conversation to the most recent one
      if (conversations.value.length > 0 && !currentConversationId.value) {
        currentConversationId.value = conversations.value[0].id
        await loadConversationHistory(currentConversationId.value)
      }
    } catch (err) {
      console.error('[Chat] Error loading conversations:', err)
    }
  }

  // Load conversation history
  async function loadConversationHistory(conversationId) {
    if (!conversationId) return
    
    isHistoryLoading.value = true
    try {
      const response = await apiService.getChatHistory(conversationId)
      const history = response.messages || response || []
      
      // Convert history to messages format
      messages.value = history.map(item => ({
        role: item.is_user ? 'user' : 'assistant',
        content: item.content || item.message,
        timestamp: item.created_at || new Date().toISOString()
      }))
    } catch (err) {
      console.error('[Chat] Error loading history:', err)
    } finally {
      isHistoryLoading.value = false
    }
  }

  // Send a message
  async function sendMessage(content) {
    if (!content.trim()) return
    
    // Add user message
    const userMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    }
    messages.value.push(userMessage)
    
    isLoading.value = true
    errorMessage.value = ''
    
    try {
      if (isOnline.value) {
        // Send to API
        const response = await apiService.sendChatMessage(content, currentConversationId.value)
        
        // Update conversation ID if new
        if (response.conversation_id && !currentConversationId.value) {
          currentConversationId.value = response.conversation_id
        }
        
        // Add assistant response
        const assistantMessage = {
          role: 'assistant',
          content: response.response || response.message || 'No response received.',
          timestamp: new Date().toISOString()
        }
        messages.value.push(assistantMessage)
        
        // Add to history
        historyItems.value.unshift({
          id: response.id || Date.now(),
          message: content,
          response: assistantMessage.content,
          created_at: new Date().toISOString()
        })
      } else {
        // Offline mode - simulate response
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const assistantMessage = {
          role: 'assistant',
          content: 'You are currently offline. Please connect to the ExamQuestionBank server to use AI chat functionality.',
          timestamp: new Date().toISOString()
        }
        messages.value.push(assistantMessage)
        
        // Save to local storage
        saveLocalMessages()
      }
    } catch (err) {
      console.error('[Chat] Send error:', err)
      errorMessage.value = err.message || 'Failed to send message'
      
      // Add error message
      messages.value.push({
        role: 'assistant',
        content: `Error: ${errorMessage.value}`,
        timestamp: new Date().toISOString(),
        isError: true
      })
    } finally {
      isLoading.value = false
    }
  }

  // Clear current messages
  function clearMessages() {
    messages.value = []
    currentConversationId.value = null
    saveLocalMessages()
  }

  // Clear error
  function clearError() {
    errorMessage.value = ''
  }

  // Refresh history
  async function refreshHistory() {
    if (isOnline.value) {
      await loadConversations()
    }
  }

  // Create new conversation
  async function createNewConversation(title = null) {
    if (!isOnline.value) {
      clearMessages()
      return
    }
    
    try {
      const response = await apiService.createConversation(title)
      currentConversationId.value = response.id
      messages.value = []
      await loadConversations()
    } catch (err) {
      console.error('[Chat] Error creating conversation:', err)
      errorMessage.value = err.message
    }
  }

  // Delete conversation
  async function deleteConversation(conversationId) {
    if (!isOnline.value) return
    
    try {
      await apiService.deleteConversation(conversationId)
      conversations.value = conversations.value.filter(c => c.id !== conversationId)
      
      if (currentConversationId.value === conversationId) {
        currentConversationId.value = null
        messages.value = []
      }
    } catch (err) {
      console.error('[Chat] Error deleting conversation:', err)
      errorMessage.value = err.message
    }
  }

  // Switch conversation
  async function switchConversation(conversationId) {
    if (currentConversationId.value === conversationId) return
    
    currentConversationId.value = conversationId
    await loadConversationHistory(conversationId)
  }

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
    
    // Computed
    hasMessages,
    hasHistory,
    
    // Actions
    initialize,
    sendMessage,
    clearMessages,
    clearError,
    refreshHistory,
    createNewConversation,
    deleteConversation,
    switchConversation,
    loadConversationHistory
  }
})
