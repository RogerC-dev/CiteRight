import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  // State
  const isOpen = ref(false)
  const width = ref(420) // Default width
  const currentTab = ref('tool') // 'tool' | 'bookmarks' | 'dictionary' | 'flashcard'

  // Constants
  const MIN_WIDTH = 320
  const MAX_RATIO = 0.6

  // Computed
  const minWidth = computed(() => MIN_WIDTH)
  const maxWidth = computed(() => Math.floor(window.innerWidth * MAX_RATIO))

  // Actions
  function open() {
    if (!isOpen.value) {
      loadSavedWidth()
      isOpen.value = true
      console.log('✅ Sidebar opened')
    }
  }

  function close() {
    if (isOpen.value) {
      isOpen.value = false
      console.log('✅ Sidebar closed')
    }
  }
  
  function setWidth(newWidth) {
    if (isNaN(newWidth) || typeof newWidth !== 'number') {
      console.warn('⚠️ Invalid width:', newWidth)
      newWidth = 420
    }

    // Constrain width
    const constrainedWidth = Math.max(minWidth.value, Math.min(newWidth, maxWidth.value))
    width.value = constrainedWidth
    
    // Save to localStorage
    saveWidth(constrainedWidth)
    
    console.log('📏 Sidebar width updated:', constrainedWidth + 'px')
  }
  
  function setCurrentTab(tab) {
    if (['tool', 'bookmarks', 'dictionary', 'flashcard'].includes(tab)) {
      currentTab.value = tab
      console.log('📑 Switched to tab:', tab)
    }
  }

  function loadSavedWidth() {
    try {
      const savedWidth = localStorage.getItem('citeright-panel-width')
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10)
        if (!isNaN(parsedWidth)) {
          width.value = Math.max(minWidth.value, Math.min(parsedWidth, maxWidth.value))
          console.log('💾 Loaded saved width:', width.value + 'px')
        }
      }
    } catch (error) {
      console.error('Failed to load saved width:', error)
    }
  }
  
  function saveWidth(widthToSave) {
    try {
      localStorage.setItem('citeright-panel-width', widthToSave.toString())
    } catch (error) {
      console.error('Failed to save width:', error)
    }
  }
  
  return {
    // State
    isOpen,
    width,
    currentTab,

    // Computed
    minWidth,
    maxWidth,

    // Actions
    open,
    close,
    setWidth,
    setCurrentTab
  }
})