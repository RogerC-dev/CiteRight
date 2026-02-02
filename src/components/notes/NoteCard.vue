<template>
  <div class="note-card" :class="{ 'is-pinned': note.is_pinned }">
    <!-- Header: Title & Pin -->
    <div class="note-header">
      <h3 class="note-title" @click="$emit('edit', note)">
        {{ note.title || '未命名筆記' }}
      </h3>
      <button 
        class="action-btn pin-btn" 
        :class="{ active: note.is_pinned }"
        @click.stop="$emit('toggle-pin', note.id)"
        title="釘選筆記"
      >
        <i class="bi" :class="note.is_pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'"></i>
      </button>
    </div>

    <!-- Source Context Badge -->
    <div v-if="note.source_metadata" class="note-source">
      <span class="source-badge">
        <i class="bi" :class="getSourceIcon(note.source_type)"></i>
        {{ getSourceLabel(note) }}
      </span>
      <span class="note-date">{{ formatDate(note.created_at) }}</span>
    </div>

    <!-- Highlighted Text (Quote) -->
    <div v-if="note.highlighted_text" class="note-quote" @click="$emit('edit', note)">
      <div class="quote-bar"></div>
      <p class="quote-text">{{ truncateText(note.highlighted_text, 60) }}</p>
    </div>

    <!-- Content Preview -->
    <div class="note-content" @click="$emit('edit', note)">
      {{ truncateText(note.content, 80) }}
    </div>

    <!-- Tags -->
    <div v-if="note.tags && note.tags.length" class="note-tags">
      <span v-for="tag in note.tags" :key="tag" class="tag">#{{ tag }}</span>
    </div>

    <!-- Actions Footer -->
    <div class="note-actions">
      <button class="action-btn ai-btn" @click.stop="$emit('ask-ai', note)">
        <i class="bi bi-stars"></i> Ask AI
      </button>
      
      <div class="right-actions">
        <button class="action-btn icon-btn" @click.stop="$emit('edit', note)" title="編輯">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="action-btn icon-btn delete-btn" @click.stop="$emit('delete', note.id)" title="刪除">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  note: {
    type: Object,
    required: true
  }
})

defineEmits(['edit', 'delete', 'toggle-pin', 'ask-ai'])

function getSourceIcon(type) {
  switch (type) {
    case 'law_article': return 'bi-book-half'
    case 'judgment': return 'bi-gavel'
    case 'interpretation': return 'bi-file-earmark-text'
    case 'webpage': return 'bi-globe'
    default: return 'bi-journal-text'
  }
}

function getSourceLabel(note) {
  const meta = note.source_metadata || {}
  if (note.source_id) return note.source_id
  if (meta.law_name) return `${meta.law_name} ${meta.article_no || ''}`
  return '一般筆記'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
}

function truncateText(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}
</script>

<style scoped>
.note-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.note-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.note-card.is-pinned {
  border-left: 3px solid var(--primary);
  background: linear-gradient(to right, rgba(var(--primary-rgb), 0.02), var(--surface));
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.note-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  line-height: 1.4;
}

.note-source {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.note-quote {
  display: flex;
  margin-bottom: 8px;
  background: var(--surface-muted);
  border-radius: 4px;
  padding: 6px;
}

.quote-bar {
  width: 3px;
  background: var(--primary);
  margin-right: 8px;
  border-radius: 2px;
}

.quote-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin: 0;
  line-height: 1.4;
}

.note-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 10px;
  white-space: pre-wrap;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tag {
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 6px;
  border-radius: 10px;
}

.note-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.action-btn:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.ai-btn {
  color: var(--primary);
  font-weight: 500;
  background: var(--primary-soft);
}

.ai-btn:hover {
  background: var(--primary);
  color: white;
}

.pin-btn.active {
  color: var(--primary);
}

.delete-btn:hover {
  color: var(--destructive, #ef4444);
  background: var(--destructive-soft, rgba(239, 68, 68, 0.1));
}

.right-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  padding: 6px;
  font-size: 14px;
}
</style>
