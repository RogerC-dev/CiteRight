import { ref, onMounted, onUnmounted } from 'vue'
import { useExtensionStore } from '../stores/extension'

export function useNoteCapture() {
    const isPopupVisible = ref(false)
    const popupPosition = ref({ x: 0, y: 0 })
    const selectedData = ref({})

    // Trigger Icon State
    const isTriggerVisible = ref(false)
    const triggerPosition = ref({ x: 0, y: 0 })

    const extensionStore = useExtensionStore()

    function handleSelection(event) {
        // Feature toggle check
        if (!extensionStore.isNoteTakingEnabled) return

        const selection = window.getSelection()
        const text = selection.toString().trim()

        if (text.length > 2 && text.length < 2000) {
            // Position near the mouse/selection
            let rect
            try {
                rect = selection.getRangeAt(0).getBoundingClientRect()
            } catch (e) {
                return
            }

            // Logic: Show simple trigger button first (Grammarly style)
            // Save data for later use
            selectedData.value = {
                highlighted_text: text,
                source_url: window.location.href,
                source_type: detectSourceType(),
                source_id: document.title
            }

            // Set trigger position (near end of selection)
            triggerPosition.value = {
                x: rect.right + window.scrollX + 5,
                y: rect.top + window.scrollY - 30
            }

            // Show trigger, hide popup
            isTriggerVisible.value = true
            isPopupVisible.value = false
        } else {
            // Clear if selection is too small or gone
            isTriggerVisible.value = false
        }
    }

    function activateNotePopup() {
        isTriggerVisible.value = false
        // Copy trigger position to popup position or center?
        popupPosition.value = { ...triggerPosition.value, y: triggerPosition.value.y + 40 }
        isPopupVisible.value = true
    }

    function detectSourceType() {
        if (window.location.href.includes('law.moj.gov.tw')) return 'law_article'
        if (window.location.href.includes('judicial.gov.tw')) return 'judgment'
        return 'webpage'
    }

    function closePopup() {
        isPopupVisible.value = false
        isTriggerVisible.value = false
        window.getSelection().removeAllRanges()
    }

    // We need to be careful not to trigger on every click inside the popup
    function onMouseUp(e) {
        // If click is inside our app container, ignore?
        // This logic is tricky. For now, let's attach to document but check target.
        const container = document.getElementById('citeright-vue-container')

        // If clicking trigger button, let it be handled by its click event not this
        if (e.target.closest('.note-trigger-btn')) return

        if (container && container.contains(e.target)) return

        // Delay to let selection finalize
        setTimeout(() => handleSelection(e), 10)
    }

    onMounted(() => {
        document.addEventListener('mouseup', onMouseUp)
    })

    onUnmounted(() => {
        document.removeEventListener('mouseup', onMouseUp)
    })

    return {
        isPopupVisible,
        popupPosition,
        selectedData,
        closePopup,

        // Trigger exports
        isTriggerVisible,
        triggerPosition,
        activateNotePopup
    }
}
