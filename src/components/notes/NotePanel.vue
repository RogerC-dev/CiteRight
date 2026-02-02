<template>
  <div class="note-panel">
    <!-- Header / Search -->
    <div class="panel-header">
      <div class="search-bar">
        <i class="bi bi-search"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜尋筆記..."
          @input="handleSearch"
        >
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
          <i class="bi bi-x-circle-fill"></i>
        </button>
      </div>
      
      <div class="filter-tabs">
        <button 
          v-for="filter in filters" 
          :key="filter.id"
          class="filter-tab"
          :class="{ active: currentFilter === filter.id }"
          @click="currentFilter = filter.id"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Note List -->
    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>載入中...</span>
      </div>

      <div v-else-if="filteredNotes.length === 0" class="empty-state">
        <div class="empty-icon">
          <i class="bi bi-journal-plus"></i>
        </div>
        <h3>尚無筆記</h3>
        <p v-if="searchQuery">找不到符合 "{{ searchQuery }}" 的筆記</p>
        <p v-else>選取文字即可快速建立筆記</p>
        <button class="btn-create" @click="openEditor()">
          <i class="bi bi-plus-lg"></i> 新增筆記
        </button>
      </div>

      <div v-else class="note-list">
        <!-- Pinned Notes Section -->
        <div v-if="pinnedNotes.length > 0 && !searchQuery" class="section-label">
          <i class="bi bi-pin-angle-fill"></i> 置頂
        </div>
        <NoteCard 
          v-for="note in pinnedNotesDisplay" 
          :key="note.id" 
          :note="note"
          @edit="openEditor(note)"
          @delete="confirmDelete(note.id)"
          @toggle-pin="handleTogglePin(note.id)"
          @ask-ai="handleAskAI(note)"
        />

        <!-- Other Notes Section -->
        <div v-if="pinnedNotes.length > 0 && unpinnedNotesDisplay.length > 0 && !searchQuery" class="section-divider"></div>
        
        <NoteCard 
          v-for="note in unpinnedNotesDisplay" 
          :key="note.id" 
          :note="note"
          @edit="openEditor(note)"
          @delete="confirmDelete(note.id)"
          @toggle-pin="handleTogglePin(note.id)"
          @ask-ai="handleAskAI(note)"
        />
      </div>
    </div>

    <!-- Editor Modal -->
    <NoteEditor 
      :is-visible="showEditor"
      :initial-data="editingNote"
      @save="handleSaveNote"
      @cancel="closeEditor"
    />

    <!-- FAB (Floating Action Button) -->
    <button class="fab-add" @click="openEditor()" title="新增筆記">
      <i class="bi bi-plus-lg"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNoteStore } from '../../stores/noteStore'
import NoteCard from './NoteCard.vue'
import NoteEditor from './NoteEditor.vue'

const store = useNoteStore()

// State
const searchQuery = ref('')
const currentFilter = ref('all')
const showEditor = ref(false)
const editingNote = ref({})

const filters = [
  { id: 'all', label: '全部' },
  { id: 'law_article', label: '法條' },
  { id: 'judgment', label: '判決' }
]

// Computed
const isLoading = computed(() => store.isLoading)
const pinnedNotes = computed(() => store.pinnedNotes)

// Filter Logic
const filteredNotes = computed(() => {
  let result = store.notes

  // 1. Text Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(n => 
      n.title?.toLowerCase().includes(q) || 
      n.content.toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    )
  }

  // 2. Type Filter
  if (currentFilter.value !== 'all') {
    result = result.filter(n => n.source_type === currentFilter.value)
  }

  return result
})

const pinnedNotesDisplay = computed(() => {
  if (searchQuery.value) return [] // In search mode, flat list usually better, but let's stick to sections or just flat
  return filteredNotes.value.filter(n => n.is_pinned)
})

const unpinnedNotesDisplay = computed(() => {
  if (searchQuery.value) return filteredNotes.value // Return all in search
  return filteredNotes.value.filter(n => !n.is_pinned)
})

// Actions
function handleSearch() {
  // Can add debounce here if needed for API search
}

function clearSearch() {
  searchQuery.value = ''
}

function openEditor(note = {}) {
  editingNote.value = { ...note } // Clone to avoid direct mutation
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editingNote.value = {}
}

async function handleSaveNote(noteData) {
  if (noteData.id) {
    await store.updateNote(noteData.id, noteData)
  } else {
    await store.addNote(noteData)
  }
  closeEditor()
}

async function confirmDelete(id) {
  if (confirm('確定要刪除這則筆記嗎？')) {
    await store.deleteNote(id)
  }
}

async function handleTogglePin(id) {
  await store.togglePin(id)
}

function handleAskAI(note) {
  // Dispatch event to parent (SidePanelApp) to switch tabs
  const event = new CustomEvent('ask-ai-note', { detail: note })
  window.dispatchEvent(event)
}

onMounted(() => {
  store.fetchNotes()
})
</script>

<style scoped>
.note-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page);
  position: relative;
}

.panel-header {
  padding: 12px 16px 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--surface-muted);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.search-bar i {
  color: var(--text-secondary);
  margin-right: 8px;
}

.search-bar input {
  border: none;
  background: transparent;
  width: 100%;
  color: var(--text-primary);
  font-size: 14px;
}

.search-bar input:focus {
  outline: none;
}

.clear-btn {
  border: none;
  background: none;
  padding: 0;
  color: var(--text-secondary);
  cursor: pointer;
}

.filter-tabs {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-tab {
  background: none;
  border: none;
  padding: 8px 4px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.filter-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--surface-muted);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.btn-create {
  margin-top: 16px;
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}

.fab-add {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
  cursor: pointer;
  transition: transform 0.2s;
  z-index: 100;
}

.fab-add:hover {
  transform: scale(1.1);
}

.fab-add:active {
  transform: scale(0.95);
}
</style>
