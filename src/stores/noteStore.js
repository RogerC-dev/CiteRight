import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useNoteStore = defineStore('notes', () => {
    // State
    const notes = ref([])
    const isLoading = ref(false)
    const error = ref(null)

    // Mock Data (Initial State)
    const mockNotes = [
        {
            id: '1',
            title: '憲法第7條 - 平等權筆記',
            content: '中華民國人民，無分男女、宗教、種族、階級、黨派，在法律上一律平等。\n重點：實質平等 vs 形式平等的區分。',
            highlighted_text: '中華民國人民，無分男女...平等',
            source_type: 'law_article',
            source_id: '憲法',
            source_metadata: {
                law_level: '法律',
                law_name: '中華民國憲法',
                article_no: '第 7 條'
            },
            tags: ['憲法', '基本權'],
            is_pinned: true,
            created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
        },
        {
            id: '2',
            title: '刑法第271條 - 殺人罪',
            content: '殺人罪構成要件分析：\n1. 客觀：殺人行為、死亡結果、因果關係\n2. 主觀：殺人故意',
            highlighted_text: '殺人者，處死刑、無期徒刑 or 10年以上有期徒刑',
            source_type: 'law_article',
            source_id: '刑法',
            source_metadata: {
                law_level: '法律',
                law_name: '中華民國刑法',
                article_no: '第 271 條'
            },
            tags: ['刑法', '殺人罪'],
            is_pinned: false,
            created_at: new Date().toISOString() // Today
        },
        {
            id: '3',
            title: '最高法院 100 年度台上字第 1234 號刑事判決',
            content: '判決要旨：\n正當防衛必須面對現在不法之侵害，始得為之。若侵害已過去，或預料未來將發生，均非正當防衛之情狀。',
            highlighted_text: '正當防衛必須面對現在不法之侵害',
            source_type: 'judgment',
            source_id: '100台上1234',
            source_metadata: {
                court: '最高法院',
                type: '刑事判決',
                case_no: '100台上1234'
            },
            tags: ['刑法', '正當防衛', '判決'],
            is_pinned: false,
            created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        }
    ]

    // Actions
    async function fetchNotes(filters = {}) {
        isLoading.value = true
        error.value = null
        try {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500))

            // In real implementation, this would call Supabase
            // For now, load mock data if empty
            if (notes.value.length === 0) {
                notes.value = [...mockNotes]
            }

        } catch (err) {
            console.error('Failed to fetch notes:', err)
            error.value = '無法載入筆記'
        } finally {
            isLoading.value = false
        }
    }

    async function addNote(noteData) {
        isLoading.value = true
        try {
            await new Promise(resolve => setTimeout(resolve, 600))

            const newNote = {
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_pinned: false,
                is_archived: false,
                ...noteData
            }

            notes.value.unshift(newNote)
            return newNote
        } catch (err) {
            console.error('Failed to add note:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function updateNote(id, updates) {
        isLoading.value = true
        try {
            await new Promise(resolve => setTimeout(resolve, 400))

            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value[index] = {
                    ...notes.value[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                }
            }
        } catch (err) {
            console.error('Failed to update note:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function deleteNote(id) {
        try {
            // Soft delete/archive
            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value.splice(index, 1) // Remove from local list for UI responsiveness
            }
        } catch (err) {
            console.error('Failed to delete note:', err)
            throw err
        }
    }

    async function togglePin(id) {
        const note = notes.value.find(n => n.id === id)
        if (note) {
            await updateNote(id, { is_pinned: !note.is_pinned })
        }
    }

    // Getters
    const pinnedNotes = computed(() => {
        return notes.value.filter(n => n.is_pinned).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })

    const unpinnedNotes = computed(() => {
        return notes.value.filter(n => !n.is_pinned).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })

    return {
        notes,
        isLoading,
        error,
        fetchNotes,
        addNote,
        updateNote,
        deleteNote,
        togglePin,
        pinnedNotes,
        unpinnedNotes
    }
})
