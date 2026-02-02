<template>
  <div class="chat-panel">
    <!-- Messages Area -->
    <div class="messages-area" ref="messagesAreaRef">
      <div v-for="(msg, index) in messages" :key="index" class="message" :class="msg.role">
        <i v-if="msg.role === 'assistant'" class="bi bi-robot me-2"></i>
        <div class="message-content">{{ msg.content }}</div>
      </div>
      
      <!-- Loading Indicator -->
      <div v-if="isLoading" class="message-loading">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea 
          v-model="inputButtons" 
          class="chat-input" 
          placeholder="輸入您的法律問題..." 
          rows="1"
          @keydown.enter.exact.prevent="sendMessage"
          @input="autoResize"
          ref="textareaRef"
          :disabled="isLoading"
        ></textarea>
        <button class="btn-send" @click="sendMessage" :disabled="!inputButtons.trim() || isLoading">
          <i class="bi bi-send-fill"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'

const props = defineProps({
  userId: {
    type: String,
    required: true
  }
})

const messages = ref([
  { role: 'assistant', content: '您好！我是 CiteRight AI 法律助手。有什麼法律問題我可以幫您解答嗎？' }
])
const inputButtons = ref('')
const isLoading = ref(false)
const messagesAreaRef = ref(null)
const textareaRef = ref(null)
const conversationId = ref(null)

const API_BASE = 'http://localhost:3000'

async function sendMessage() {
  const text = inputButtons.value.trim()
  if (!text || isLoading.value) return

  // Add User Message
  messages.value.push({ role: 'user', content: text })
  inputButtons.value = ''
  resetHeight()
  scrollToBottom()

  isLoading.value = true

  try {
    if (!conversationId.value) {
      conversationId.value = 'conv_' + Date.now()
    }

    // Build context
    const context = messages.value.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }))

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': props.userId
      },
      body: JSON.stringify({
        message: text,
        conversationId: conversationId.value,
        context: context
      })
    })

    const data = await response.json()

    if (!response.ok) {
       throw new Error(data.error || 'Failed to get response')
    }

    // Add Network Response
    messages.value.push({ role: 'assistant', content: data.response || data.message })

  } catch (error) {
    console.error('Chat error:', error)
    messages.value.push({ role: 'assistant', content: `發生錯誤：${error.message}` })
  } finally {
    isLoading.value = false
    nextTick(scrollToBottom)
  }
}

function scrollToBottom() {
  if (messagesAreaRef.value) {
    messagesAreaRef.value.scrollTop = messagesAreaRef.value.scrollHeight
  }
}

function autoResize() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 120) + 'px'
  }
}

function resetHeight() {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
    }
}
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-page);
}

.message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
}

.message.user {
  align-self: flex-end;
  background: var(--primary); /* Use solid color for now or var(--gradient-primary) */
  color: #fff;
  background-image: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
}

.message.assistant {
  align-self: flex-start;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.message-loading {
  align-self: flex-start;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.input-area {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 10px 16px;
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
  max-height: 120px;
}

.chat-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.btn-send {
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  background-image: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
}

.btn-send:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
</style>
