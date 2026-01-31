<template>
  <Teleport to="body">
    <button
      v-if="!sidebarStore.isOpen"
      ref="floatingBtnRef"
      class="floating-sidebar-btn"
      :class="{ 'is-dragging': isDragging }"
      :style="floatingBtnStyle"
      @mousedown="startDrag"
      @touchstart="startDrag"
      aria-label="Ask AI"
      title="Ask AI"
    >
      <svg class="floating-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Magnifying glass -->
        <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/>
        <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <!-- Sparkles -->
        <path d="M18 4L18.5 5.5L20 6L18.5 6.5L18 8L17.5 6.5L16 6L17.5 5.5L18 4Z" fill="currentColor"/>
        <path d="M4 2L4.35 3L5 3.35L4.35 3.7L4 4.7L3.65 3.7L3 3.35L3.65 3L4 2Z" fill="currentColor"/>
        <path d="M5 14L5.25 14.75L6 15L5.25 15.25L5 16L4.75 15.25L4 15L4.75 14.75L5 14Z" fill="currentColor"/>
      </svg>
    </button>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSidebarStore } from '../../stores/sidebar'

// Store
const sidebarStore = useSidebarStore()

// Floating button state
const floatingBtnRef = ref(null)
const btnPos = ref({ x: null, y: null, side: 'right', snapping: false })
const isDragging = ref(false)
const hasDragged = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const btnStartPos = ref({ x: 0, y: 0 })

// Constants
const BTN_SIZE = 56
const PADDING = 16

// Computed style for floating button
const floatingBtnStyle = computed(() => {
  if (btnPos.value.x === null || btnPos.value.y === null) {
    return {} // Use default CSS position (bottom-right)
  }
  return {
    left: `${btnPos.value.x}px`,
    top: `${btnPos.value.y}px`,
    right: 'auto',
    bottom: 'auto',
    transition: btnPos.value.snapping 
      ? 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.3s ease' 
      : 'none'
  }
})

// Drag handlers
function startDrag(e) {
  e.preventDefault()
  isDragging.value = true
  hasDragged.value = false

  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY

  dragStart.value = { x: clientX, y: clientY }

  // Get current button position
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  btnStartPos.value = { x: rect.left, y: rect.top }

  // Initialize position if first drag
  if (btnPos.value.x === null) {
    btnPos.value = { x: rect.left, y: rect.top, side: 'right', snapping: false }
  }
  btnPos.value.snapping = false

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value) return
  e.preventDefault()

  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY

  const deltaX = clientX - dragStart.value.x
  const deltaY = clientY - dragStart.value.y

  // Check if user has moved enough to count as a drag
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    hasDragged.value = true
  }

  // Allow free movement during drag
  let newX = btnStartPos.value.x + deltaX
  let newY = btnStartPos.value.y + deltaY

  // Constrain to viewport
  newX = Math.max(PADDING, Math.min(window.innerWidth - BTN_SIZE - PADDING, newX))
  newY = Math.max(PADDING, Math.min(window.innerHeight - BTN_SIZE - PADDING, newY))

  btnPos.value = { ...btnPos.value, x: newX, y: newY, snapping: false }
}

function stopDrag() {
  isDragging.value = false

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)

  // If not dragged, treat as click - open sidebar
  if (!hasDragged.value) {
    openSidebar()
    return
  }

  // Snap to nearest side with animation (magnet behavior)
  const currentX = btnPos.value.x
  const midPoint = window.innerWidth / 2

  // Determine which side to snap to
  const side = (currentX + BTN_SIZE / 2) < midPoint ? 'left' : 'right'
  const targetX = side === 'left' ? PADDING : window.innerWidth - BTN_SIZE - PADDING

  // Enable snapping animation and set target position
  btnPos.value = {
    ...btnPos.value,
    x: targetX,
    side,
    snapping: true
  }

  // Save position preference
  savePosition()
}

function openSidebar() {
  sidebarStore.open()
}

function savePosition() {
  try {
    localStorage.setItem('citeright-floating-btn-pos', JSON.stringify({
      y: btnPos.value.y,
      side: btnPos.value.side
    }))
  } catch (e) {
    console.warn('Failed to save floating button position:', e)
  }
}

function loadPosition() {
  try {
    const saved = localStorage.getItem('citeright-floating-btn-pos')
    if (saved) {
      const parsed = JSON.parse(saved)
      const targetX = parsed.side === 'left' ? PADDING : window.innerWidth - BTN_SIZE - PADDING
      const targetY = Math.max(PADDING, Math.min(window.innerHeight - BTN_SIZE - PADDING, parsed.y || window.innerHeight - BTN_SIZE - 24))
      btnPos.value = {
        x: targetX,
        y: targetY,
        side: parsed.side || 'right',
        snapping: false
      }
    }
  } catch (e) {
    console.warn('Failed to load floating button position:', e)
  }
}

// Handle window resize
function handleWindowResize() {
  if (btnPos.value.x !== null) {
    // Recalculate position based on current side
    const targetX = btnPos.value.side === 'left' ? PADDING : window.innerWidth - BTN_SIZE - PADDING
    const constrainedY = Math.max(PADDING, Math.min(window.innerHeight - BTN_SIZE - PADDING, btnPos.value.y))
    btnPos.value = { ...btnPos.value, x: targetX, y: constrainedY }
  }
}

onMounted(() => {
  loadPosition()
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
})
</script>

<style scoped>
.floating-sidebar-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  padding: 0;
  /* Updated to match Web App PracticeView.vue exactly */
  background: linear-gradient(135deg, #4A90D9, #3B7FCC);
  color: #fff;
  border: none;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(74, 144, 217, 0.4);
  cursor: grab;
  z-index: 2147483640;
  touch-action: none;
  transition: box-shadow 0.2s, transform 0.2s;
}

.floating-sidebar-btn:hover {
  box-shadow: 0 6px 24px rgba(74, 144, 217, 0.5);
  transform: scale(1.02);
}

.floating-sidebar-btn:active,
.floating-sidebar-btn.is-dragging {
  cursor: grabbing;
  transform: scale(1.05);
}

.floating-btn-icon {
  width: 32px;
  height: 32px;
  color: #fff;
  pointer-events: none;
}

/* Responsive - smaller on mobile */
@media (max-width: 768px) {
  .floating-sidebar-btn {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .floating-btn-icon {
    width: 26px;
    height: 26px;
  }
}
</style>
