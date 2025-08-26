<template>
  <div
    v-if="visible"
    :id="'citeright-popover'"
    :style="popoverStyle"
    class="citeright-popover"
    @mouseenter="clearHideTimer"
    @mouseleave="startHideTimer"
  >
    <!-- Header with drag functionality -->
    <div
      class="citeright-header"
      @mousedown="startDrag"
      :style="{ cursor: isDragging ? 'grabbing' : 'move' }"
    >
      <span class="popover-title">📄 {{ caseData.title || '判決摘要' }}</span>
      <button
        class="citeright-close"
        @click="closePopover"
        @mouseenter="clearHideTimer"
      >
        &times;
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="citeright-loader">
      🔄 載入中...
    </div>

    <!-- Content -->
    <div v-else-if="caseData.loaded" class="citeright-content">
      <div class="case-info">
        <div v-if="caseData.caseNumber" class="info-row">
          <strong>案號：</strong>{{ caseData.caseNumber }}
        </div>
        <div v-if="caseData.title" class="info-row">
          <strong>案由：</strong>{{ caseData.title }}
        </div>
        <div v-if="caseData.court" class="info-row">
          <strong>法院：</strong>{{ caseData.court }}
        </div>
        <div v-if="caseData.date" class="info-row">
          <strong>日期：</strong>{{ caseData.date }}
        </div>
      </div>

      <hr v-if="caseData.content" />

      <div v-if="caseData.content" class="case-summary">
        <div class="summary-content">{{ caseData.content }}</div>
      </div>

      <div v-if="caseData.source" class="source-info">
        資料來源：{{ caseData.source }}
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="citeright-error">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

export default {
  name: 'CasePopover',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    targetElement: {
      type: Object,
      default: null
    },
    caseInfo: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['close', 'update:visible'],
  setup(props, { emit }) {
    // Reactive state
    const loading = ref(false)
    const error = ref('')
    const position = reactive({ x: 0, y: 0 })
    const isDragging = ref(false)
    const dragOffset = reactive({ x: 0, y: 0 })

    // Case data
    const caseData = reactive({
      loaded: false,
      title: '',
      caseNumber: '',
      court: '',
      date: '',
      content: '',
      source: ''
    })

    // Hide timer for hover behavior
    let hideTimer = null

    // Computed styles
    const popoverStyle = computed(() => ({
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      zIndex: '2147483647',
      background: '#fff',
      border: '2px solid #007bff',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,.3)',
      width: '450px',
      maxWidth: '90vw',
      fontFamily: 'Microsoft JhengHei, Arial, sans-serif',
      fontSize: '14px',
      color: '#333',
      pointerEvents: 'auto'
    }))

    // Position the popover near the target element
    const updatePosition = () => {
      if (!props.targetElement) return

      const rect = props.targetElement.getBoundingClientRect()
      let left = rect.left + window.scrollX
      let top = rect.top + window.scrollY - 350

      // Smart positioning to stay within viewport
      if (left + 450 > window.innerWidth) {
        left = window.innerWidth - 460
      }
      if (top < 10) {
        top = rect.bottom + window.scrollY + 10
      }

      position.x = Math.max(10, left)
      position.y = Math.max(10, top)
    }

    // Load case data from API
    const loadCaseData = async () => {
      if (!props.caseInfo.year && !props.caseInfo.caseType && !props.caseInfo.number) {
        error.value = '案號格式不完整'
        return
      }

      loading.value = true
      error.value = ''

      try {
        const { year, caseType, number } = props.caseInfo

        const apiUrl = caseType === '釋字'
          ? `http://localhost:3002/api/case?caseType=${encodeURIComponent(caseType)}&number=${number}`
          : `http://localhost:3002/api/case?year=${year}&caseType=${encodeURIComponent(caseType)}&number=${number}`

        const response = await fetch(apiUrl)
        const data = await response.json()

        if (data.error) {
          error.value = data.error
        } else {
          const apiData = data.data || data
          caseData.loaded = true
          caseData.title = apiData.JTITLE || '無資料'
          caseData.caseNumber = data.caseNumber || (apiData.JYEAR + '年度' + apiData.JCASE + '字第' + apiData.JNO + '號')
          caseData.court = apiData.JCOURT || '無資料'
          caseData.date = apiData.JDATE || '無資料'
          caseData.content = (apiData.JFULLCONTENT || apiData.JFULL || '暫無內容').substring(0, 400) + '...'
          caseData.source = data.source || '司法院開放資料'
        }
      } catch (err) {
        error.value = '無法連線至後端服務'
      } finally {
        loading.value = false
      }
    }

    // Drag functionality
    const startDrag = (e) => {
      if (e.target.classList.contains('citeright-close')) return

      isDragging.value = true
      dragOffset.x = e.clientX - position.x
      dragOffset.y = e.clientY - position.y

      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', stopDrag)
      e.preventDefault()
    }

    const handleDrag = (e) => {
      if (!isDragging.value) return

      let newX = e.clientX - dragOffset.x
      let newY = e.clientY - dragOffset.y

      // Keep within viewport bounds
      newX = Math.max(0, Math.min(newX, window.innerWidth - 450))
      newY = Math.max(0, Math.min(newY, window.innerHeight - 50))

      position.x = newX
      position.y = newY
    }

    const stopDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', stopDrag)
    }

    // Hover timer management
    const clearHideTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const startHideTimer = () => {
      clearHideTimer()
      hideTimer = setTimeout(() => {
        // Only auto-hide if not clicked to stay open
        if (!caseData.stayOpen) {
          closePopover()
        }
      }, 500)
    }

    // Close popover
    const closePopover = () => {
      clearHideTimer()
      caseData.loaded = false
      caseData.stayOpen = false
      emit('close')
      emit('update:visible', false)
    }

    // Keyboard shortcuts
    const handleKeydown = (e) => {
      if (e.key === 'Escape' && props.visible) {
        closePopover()
      }
    }

    // Lifecycle hooks
    onMounted(() => {
      document.addEventListener('keydown', handleKeydown)

      if (props.visible && props.targetElement) {
        updatePosition()
        loadCaseData()
      }
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', stopDrag)
      clearHideTimer()
    })

    // Watch for visibility changes
    const show = () => {
      if (props.targetElement) {
        updatePosition()
        loadCaseData()
        // Mark as staying open when explicitly shown
        caseData.stayOpen = true
      }
    }

    return {
      loading,
      error,
      caseData,
      popoverStyle,
      isDragging,
      startDrag,
      closePopover,
      clearHideTimer,
      startHideTimer,
      show
    }
  }
}
</script>

<style scoped>
.citeright-popover {
  font-family: 'Microsoft JhengHei', Arial, sans-serif;
}

.citeright-header {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 6px 6px 0 0;
  user-select: none;
}

.popover-title {
  font-weight: 600;
  color: #1890ff;
  font-size: 16px;
}

.citeright-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 4px;
  margin: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.citeright-close:hover {
  background-color: #e9ecef;
  color: #333;
}

.citeright-loader {
  padding: 20px;
  text-align: center;
  color: #666;
  background: white;
}

.citeright-content {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border-radius: 0 0 6px 6px;
}

.info-row {
  margin-bottom: 8px;
  color: #333;
}

.info-row strong {
  color: #1890ff;
}

.case-summary {
  margin-top: 12px;
}

.summary-content {
  color: #555;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border-left: 5px solid #1890ff;
  white-space: pre-wrap;
  line-height: 1.6;
}

.source-info {
  margin-top: 12px;
  padding: 6px 8px;
  background-color: #e6f7ff;
  border-radius: 4px;
  font-size: 11px;
  color: #1890ff;
  text-align: center;
  border: 1px solid #91d5ff;
}

.citeright-error {
  color: #d32f2f;
  padding: 12px;
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  margin: 8px;
}

hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 12px 0;
}

/* Custom scrollbar */
.citeright-content::-webkit-scrollbar {
  width: 6px;
}

.citeright-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
