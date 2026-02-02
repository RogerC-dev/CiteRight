<template>
  <div class="note-editor" :class="{ 'is-visible': isVisible }">
    <div class="editor-overlay" @click="$emit('cancel')"></div>
    <div class="editor-panel">
      <!-- Toolbar -->
      <div class="editor-header">
        <h3 class="editor-title">{{ isEditing ? '編輯筆記' : '新增筆記' }}</h3>
        <div class="header-actions">
          <button class="btn-cancel" @click="$emit('cancel')">取消</button>
          <button class="btn-save" @click="saveNote" :disabled="!isValid">
            儲存
          </button>
        </div>
      </div>

      <!-- Editor Content -->
      <div class="editor-content">
        <!-- Title Input -->
        <div class="form-group">
          <input 
            v-model="formData.title" 
            type="text" 
            class="title-input" 
            placeholder="筆記標題..."
            autofocus
          >
        </div>

        <!-- Highlighted Text Context -->
        <div v-if="formData.highlighted_text" class="context-box">
          <div class="context-label">
            <i class="bi bi-quote"></i> 引用原文
          </div>
          <div class="context-text">
            {{ formData.highlighted_text }}
          </div>
        </div>
        
        <!-- Source Context -->
        <div v-if="formData.source_id" class="context-badge-display">
          <i class="bi bi-link-45deg"></i>
          <span>連結至: {{ formData.source_id }}</span>
        </div>

        <!-- Main Content -->
        <div class="form-group content-group">
          <textarea 
            v-model="formData.content" 
            class="content-input" 
            placeholder="輸入筆記內容..."
            ref="textareaRef"
          ></textarea>
        </div>

        <!-- Tags Input -->
        <div class="form-group">
          <div class="tags-input-container">
            <i class="bi bi-hash icon-prefix"></i>
            <input 
              v-model="tagInput"
              type="text"
              class="tag-input"
              placeholder="新增標籤 (按 Enter)"
              @keydown.enter.prevent="addTag"
              @keydown.space.prevent="addTag"
            >
          </div>
          <div class="tags-list">
            <span v-for="tag in formData.tags" :key="tag" class="tag-pill">
              #{{ tag }}
              <button class="tag-remove" @click="removeTag(tag)">
                <i class="bi bi-x"></i>
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  isVisible: Boolean,
  initialData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['save', 'cancel'])

const isEditing = computed(() => !!props.initialData.id)
const textareaRef = ref(null)
const tagInput = ref('')

const formData = reactive({
  title: '',
  content: '',
  highlighted_text: '',
  source_id: '',
  source_type: '',
  source_metadata: null,
  tags: []
})

// Auto-populate form when opened
watch(() => props.isVisible, (newVal) => {
  if (newVal) {
    if (props.initialData) {
      Object.assign(formData, {
        title: props.initialData.title || '',
        content: props.initialData.content || '',
        highlighted_text: props.initialData.highlighted_text || '',
        source_id: props.initialData.source_id || '',
        source_type: props.initialData.source_type || '',
        source_metadata: props.initialData.source_metadata || null,
        tags: [...(props.initialData.tags || [])]
      })
    } else {
      // Reset
      Object.assign(formData, {
        title: '',
        content: '',
        highlighted_text: '',
        source_id: '',
        source_type: '',
        source_metadata: null,
        tags: []
      })
    }
  }
})

const isValid = computed(() => formData.content.trim().length > 0)

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !formData.tags.includes(tag)) {
    formData.tags.push(tag)
  }
  tagInput.value = ''
}

function removeTag(tagToRemove) {
  formData.tags = formData.tags.filter(tag => tag !== tagToRemove)
}

function saveNote() {
  if (!isValid.value) return
  emit('save', { ...formData })
}
</script>

<style scoped>
.note-editor {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.note-editor.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.editor-panel {
  position: relative;
  width: 100%;
  height: 85%;
  background: var(--surface);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.note-editor.is-visible .editor-panel {
  transform: translateY(0);
}

.editor-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-cancel {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
}

.btn-save {
  background: var(--primary);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.title-input {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  border: none;
  background: transparent;
  width: 100%;
}

.title-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.title-input:focus {
  outline: none;
}

.content-group {
  flex: 1;
  min-height: 200px;
}

.content-input {
  width: 100%;
  height: 100%;
  resize: none;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.6;
}

.content-input:focus {
  outline: none;
}

.context-box {
  background: var(--surface-muted);
  border-left: 3px solid var(--primary);
  padding: 10px;
  border-radius: 4px;
}

.context-label {
  font-size: 12px;
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.context-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
  max-height: 80px;
  overflow-y: auto;
}

.context-badge-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  align-self: flex-start;
}

.tags-input-container {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  margin-bottom: 8px;
}

.icon-prefix {
  color: var(--text-secondary);
  margin-right: 8px;
}

.tag-input {
  border: none;
  background: transparent;
  width: 100%;
  color: var(--text-primary);
  font-size: 13px;
}

.tag-input:focus {
  outline: none;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill {
  font-size: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-remove {
  border: none;
  background: none;
  padding: 0;
  display: flex;
  color: var(--text-secondary);
  cursor: pointer;
}

.tag-remove:hover {
  color: var(--destructive);
}
</style>
