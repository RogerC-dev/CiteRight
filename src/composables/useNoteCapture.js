import { ref, onMounted, onUnmounted } from 'vue'

export function useNoteCapture() {
    const isPopupVisible = ref(false)
    const popupPosition = ref({ x: 0, y: 0 })
    const selectedData = ref({})

    function handleSelection(event) {
        const selection = window.getSelection()
        const text = selection.toString().trim()

        if (text.length > 5) {
            // Basic positioning near the mouse/selection
            const rect = selection.getRangeAt(0).getBoundingClientRect()
            popupPosition.value = {
                x: rect.left + window.scrollX,
                y: rect.bottom + window.scrollY + 10
            }

            // Simple context detection (placeholder for now)
            selectedData.value = {
                highlighted_text: text,
                source_url: window.location.href,
                source_type: detectSourceType(),
                source_id: document.title
            }

            // Don't show immediately (maybe wait for button click? or show icon first?)
            // For MVP, let's show an icon or just the popup?
            // The spec said "Context menu or floating button appears".
            // Let's rely on the user explicitly triggering it or a small button.
            // For this implementation, let's show the popup directly if it's a clear selection?
            // Or better: Show a small "trigger" button first (which is part of the Popup component logic usually).

            // Let's toggle visibility
            isPopupVisible.value = true
        }
    }

    function detectSourceType() {
        if (window.location.href.includes('law.moj.gov.tw')) return 'law_article'
        if (window.location.href.includes('judicial.gov.tw')) return 'judgment'
        return 'webpage'
    }

    function closePopup() {
        isPopupVisible.value = false
        window.getSelection().removeAllRanges()
    }

    // We need to be careful not to trigger on every click inside the popup
    function onMouseUp(e) {
        // If click is inside our app container, ignore?
        // This logic is tricky. For now, let's attach to document but check target.
        const container = document.getElementById('citeright-vue-container')
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
        closePopup
    }
}
