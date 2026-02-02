<template>
  <transition name="pop">
    <div v-if="isVisible" class="capture-popup" :style="positionStyle">
      <div class="popup-header">
        <div class="drag-handle">
          <i class="bi bi-grip-vertical"></i>
        </div>
        <span class="popup-title">快速筆記</span>
        <button class="close-btn" @click="$emit('close')">
          <i class="bi bi-x"></i>
        </button>
      </div>

      <div class="popup-content">
        <!-- Highlight Preview -->
        <div v-if="formData.highlighted_text" class="highlight-preview">
          <div class="highlight-bar"></div>
          <p>{{ truncate(formData.highlighted_text, 50) }}</p>
        </div>
        
        <!-- Context Badge -->
        <div v-if="formData.source_id" class="context-row">
            <NoteContextBadge :type="formData.source_type" :label="formData.source_id" />
        </div>

        <!-- Note Input -->
        <textarea 
          v-model="formData.content"
          placeholder="寫下你的想法..." 
          class="note-input"
          autofocus
          @keydown.ctrl.enter="saveNote"
        ></textarea>
      </div>

      <div class="popup-footer">
        <button class="btn-ask-ai" @click="askAI">
          <i class="bi bi-stars"></i> Ask AI
        </button>
        <button class="btn-save" @click="saveNote" :disabled="!formData.content.trim()">
          儲存 (Ctrl+Enter)
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import NoteContextBadge from './NoteContextBadge.vue'

const props = defineProps({
  isVisible: Boolean,
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  initialData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'save', 'ask-ai'])

const formData = reactive({
  content: '',
  highlighted_text: '',
  source_type: '',
  source_id: ''
})

// Initialize from props
onMounted(() => {
    Object.assign(formData, props.initialData)
})

const positionStyle = computed(() => {
  // Simple clamping to prevent going off-screen (basic)
  return {
    top: `${Math.max(10, props.position.y)}px`,
    left: `${Math.max(10, props.position.x)}px`
  }
})

function truncate(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

function saveNote() {
  if (!formData.content.trim()) return
  emit('save', { ...formData })
}

function askAI() {
  emit('ask-ai', { ...formData })
}
</script>

<style scoped>
.capture-popup {
  position: fixed;
  width: 300px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.popup-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  cursor: grab;
}

.drag-handle {
  color: var(--text-secondary);
  cursor: grab;
  margin-right: 8px;
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  color: var(--text-secondary);
  cursor: pointer;
}

.popup-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.highlight-preview {
  display: flex;
  padding: 8px;
  background: #fff9db; /* Yellow highlight color */
  border-radius: 6px;
  font-size: 12px;
  color: #495057;
}

.highlight-bar {
  width: 3px;
  background: #fab005;
  margin-right: 8px;
  border-radius: 2px;
}

.highlight-preview p {
  margin: 0;
  font-style: italic;
}

.context-row {
    margin-bottom: 4px;
}

.note-input {
  width: 100%;
  min-height: 80px;
  resize: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  font-size: 14px;
  font-family: inherit;
  background: var(--bg-page);
  color: var(--text-primary);
}

.note-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.popup-footer {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border);
}

.btn-ask-ai, .btn-save {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-ask-ai {
  background: var(--primary-soft);
  color: var(--primary);
}

.btn-ask-ai:hover {
  background: #dbdffc;
}

.btn-save {
  background: var(--primary);
  color: white;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.pop-enter-active, .pop-leave-active {
  transition: all 0.2s;
}

.pop-enter-from, .pop-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
