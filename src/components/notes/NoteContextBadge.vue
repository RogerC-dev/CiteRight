<template>
  <span class="context-badge" :class="type">
    <i class="bi" :class="icon"></i>
    <span class="text">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'law_article'
  },
  label: {
    type: String,
    required: true
  }
})

const icon = computed(() => {
  switch (props.type) {
    case 'law_article': return 'bi-book-half'
    case 'judgment': return 'bi-gavel'
    case 'interpretation': return 'bi-file-earmark-text'
    case 'webpage': return 'bi-globe'
    default: return 'bi-journal-text'
  }
})
</script>

<style scoped>
.context-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.context-badge.law_article {
  background: var(--primary-soft);
  color: var(--primary);
}

.context-badge.judgment {
  background: #fdf2f8; /* pink-50 */
  color: #db2777; /* pink-600 */
}

.context-badge.interpretation {
  background: #f0fdf4; /* green-50 */
  color: #16a34a; /* green-600 */
}

.context-badge.webpage {
  background: var(--surface-muted);
  color: var(--text-secondary);
}
</style>
