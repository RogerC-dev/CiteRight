<template>
  <div 
    v-if="visible"
    class="note-trigger-btn"
    :style="style"
    @click.stop="$emit('click')"
  >
    <div class="icon-wrapper">
      <i class="bi bi-pencil-fill"></i>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
})

const emit = defineEmits(['click'])

const style = computed(() => ({
  top: `${props.position.y}px`,
  left: `${props.position.x}px`
}))
</script>

<style scoped>
.note-trigger-btn {
  position: absolute;
  z-index: 10001; /* Above most things, below popup */
  cursor: pointer;
  animation: fadeIn 0.2s ease;
  pointer-events: auto; /* Ensure clickable */
}

.icon-wrapper {
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #476996;
  border: 1px solid #e1e1e1;
  transition: all 0.2s ease;
}

.icon-wrapper:hover {
  transform: scale(1.1);
  background: #f8fafc;
  color: #2563eb;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
</style>
