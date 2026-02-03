<template>
  <transition name="pop">
    <div v-if="isVisible" ref="popupRef" class="capture-popup" :style="positionStyle">
      <div class="popup-header" @mousedown="startDrag">
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
          @mousedown.stop
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

      <!-- Resize Handle (CSS Grip) -->
      <div class="resize-handle" @mousedown.prevent.stop="startResize"></div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
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
const popupRef = ref(null) // Ref for dragging

const formData = reactive({
  content: '',
  highlighted_text: '',
  source_type: '',
  source_id: ''
})

// Dragging State
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
// Local position state to override props when dragged
const localPosition = ref(null)

// Resizing State
const isResizing = ref(false)
const popupSize = ref({ width: 300, height: null }) // null means auto
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0 })

// Initialize from props and storage
onMounted(async () => {
    Object.assign(formData, props.initialData)
    await loadPreferences()
})

watch(() => props.isVisible, async (newVal) => {
    if (newVal) {
        await loadPreferences()
    }
})

// Storage Keys
const STORAGE_KEY_SIZE = 'citeright_note_size'
const STORAGE_KEY_POS = 'citeright_note_pos'

async function loadPreferences() {
    if (typeof chrome === 'undefined' || !chrome.storage) return
    
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY_SIZE, STORAGE_KEY_POS])
        
        if (result[STORAGE_KEY_SIZE]) {
            popupSize.value = result[STORAGE_KEY_SIZE]
            // Apply immediately to DOM if ref exists
            if (popupRef.value) {
                popupRef.value.style.width = `${popupSize.value.width}px`
                popupRef.value.style.height = `${popupSize.value.height}px`
            }
        }
        
        if (result[STORAGE_KEY_POS]) {
            // Restore last known position
            localPosition.value = result[STORAGE_KEY_POS]
        }
    } catch (e) {
        console.error('Failed to load note preferences:', e)
    }
}

async function savePreference(key, value) {
    if (typeof chrome === 'undefined' || !chrome.storage) return
    try {
        await chrome.storage.local.set({ [key]: value })
    } catch (e) {
        console.error('Failed to save note preference:', e)
    }
}

// Need ref for resize logic (finding current rect)
// But wait, setup uses popupRef which we defined but didn't bind in template
// Let's assume we bind it now.
// Actually, earlier I defined const popupRef = ref(null) but didn't use it in template.
// I need to add ref="popupRef" to the root div.

const positionStyle = computed(() => {
  if (localPosition.value) {
    return {
      top: `${localPosition.value.y}px`,
      left: `${localPosition.value.x}px`
    }
  }
  
  // Smart positioning to prevent going off-screen (Viewport relative)
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  const POPUP_WIDTH = popupSize.value.width || 300
  const BOX_HEIGHT = 300 // estimate
  const PADDING = 20
  
  // Calculate best position
  let left = props.position.x
  let top = props.position.y
  
  // Check edges
  if (left + POPUP_WIDTH > windowWidth) {
    left = Math.max(PADDING, windowWidth - POPUP_WIDTH - PADDING)
  }
  
  if (top + BOX_HEIGHT > windowHeight) {
      top = Math.max(PADDING, windowHeight - BOX_HEIGHT - PADDING)
  }
  
  return {
    top: `${top}px`,
    left: `${left}px`
    // Width/Height are now handled by direct DOM or cached state, 
    // mostly to avoid fighting with the resize handler
  }
})

// Drag Logic
function startDrag(e) {
  if (e.target.closest('.close-btn')) return // Don't drag if closing
  isDragging.value = true
  
  // Calculate offset relative to the popup's top-left corner
  // Note: We need to use valid rect from the element
  // Since we are using style top/left, we can just use clientX/Y diff
  // but let's be robust
  const rect = e.currentTarget.parentElement.getBoundingClientRect() // header's parent is popup
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault() // Prevent text selection
}

function handleDrag(e) {
  if (!isDragging.value) return
  
  // Viewport coordinates (Fixed position)
  let x = e.clientX - dragOffset.value.x
  let y = e.clientY - dragOffset.value.y
  
  // Bounds checking
  const maxX = window.innerWidth - 100
  const maxY = window.innerHeight - 50
  
  x = Math.max(0, Math.min(x, maxX))
  y = Math.max(0, Math.min(y, maxY))

  localPosition.value = { x, y }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  
  if (localPosition.value) {
      savePreference(STORAGE_KEY_POS, localPosition.value)
  }
}

// Resize Logic
function startResize(e) {
  if (!popupRef.value) {
      console.warn('NotePopup: popupRef is null')
      return 
  }
  
  console.log('NotePopup: Start Resize')
  isResizing.value = true
  resizeStartPos.value = { x: e.clientX, y: e.clientY }
  
  // Get current size to initialize
  const rect = popupRef.value.getBoundingClientRect()
  resizeStartSize.value = { width: rect.width, height: rect.height }
  
  // Force styles to be explicit pixels before resizing starts
  popupRef.value.style.width = `${rect.width}px`
  popupRef.value.style.height = `${rect.height}px`
  
  // Initialize height state if it was auto
  if (!popupSize.value.height) {
     popupSize.value.height = rect.height
  }
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'nwse-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
  e.stopPropagation()
}

function handleResize(e) {
  if (!isResizing.value || !popupRef.value) return
  
  const dx = e.clientX - resizeStartPos.value.x
  const dy = e.clientY - resizeStartPos.value.y
  
  const newWidth = Math.max(250, resizeStartSize.value.width + dx)
  const newHeight = Math.max(200, resizeStartSize.value.height + dy)
  
  // Direct DOM update for performance and reliability
  popupRef.value.style.width = `${newWidth}px`
  popupRef.value.style.height = `${newHeight}px`
  
  // Update state for logic consistency (throttled/lazy or just sync)
  popupSize.value = { width: newWidth, height: newHeight }
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  
  savePreference(STORAGE_KEY_SIZE, popupSize.value)
}

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
  /* Define variables explicitly since we are in content script */
  --surface: #ffffff;
  --surface-muted: #f8fafc;
  --border: #cbd5e1;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --primary: #476996;
  --primary-soft: #EEF2FF;
  
  position: fixed;
  width: 300px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  /* Removed overflow: hidden to allow handle interaction at edges if needed, but flex column usually needs it for border radius */
  /* Re-adding it but with caution */
  overflow: hidden; 
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto; /* Fix for clicking */
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
  flex: 1; /* Allow content to fill space */
  overflow: hidden; /* Prevent spill */
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
  flex: 1; /* Fill remaining space */
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
  /* Add padding to prevent Save button from being covered by resize handle */
  padding-right: 24px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  position: relative;
  background: var(--surface);
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

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  z-index: 50; 
  pointer-events: auto;
}

/* Subtle corner grip visual (The "L" shape) */
.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-right: 2px solid var(--text-secondary);
  border-bottom: 2px solid var(--text-secondary);
  opacity: 0.6;
  transition: all 0.2s;
}

.resize-handle:hover::after {
  opacity: 1;
  border-color: var(--primary);
  width: 8px;
  height: 8px;
}
</style>
```
