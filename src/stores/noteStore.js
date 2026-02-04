import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const useNoteStore = defineStore('notes', () => {
    // State
    const notes = ref([])
    const isLoading = ref(false)
    const error = ref(null)

    // Actions
    async function fetchNotes(filters = {}) {
        isLoading.value = true
        error.value = null
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                console.log('No authenticated user, skipping note fetch')
                notes.value = []
                return
            }

            let query = supabase
                .from('legal_note')
                .select('*')
                .eq('is_archived', false)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })

            // Apply filters if provided
            if (filters.source_type) {
                query = query.eq('source_type', filters.source_type)
            }
            if (filters.source_id) {
                query = query.eq('source_id', filters.source_id)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError

            notes.value = data || []
            console.log(`Loaded ${notes.value.length} legal notes from database`)
        } catch (err) {
            console.error('Failed to fetch notes:', err)
            error.value = '無法載入筆記'
        } finally {
            isLoading.value = false
        }
    }

    async function addNote(noteData) {
        isLoading.value = true
        error.value = null
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            const { data, error: insertError } = await supabase
                .from('legal_note')
                .insert({
                    user_id: user.id,
                    title: noteData.title,
                    content: noteData.content,
                    content_html: noteData.content_html,
                    source_type: noteData.source_type,
                    source_id: noteData.source_id,
                    source_url: noteData.source_url,
                    source_metadata: noteData.source_metadata,
                    highlighted_text: noteData.highlighted_text,
                    tags: noteData.tags || [],
                    is_pinned: noteData.is_pinned || false,
                    is_archived: false
                })
                .select()
                .single()

            if (insertError) throw insertError

            notes.value.unshift(data)

            // Generate embedding async (don't block UI)
            generateEmbedding(data.id, data.content).catch(err => {
                console.error('Failed to generate embedding:', err)
            })

            console.log('Legal note created:', data.id)
            return data
        } catch (err) {
            console.error('Failed to add note:', err)
            error.value = '無法新增筆記'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function updateNote(id, updates) {
        isLoading.value = true
        error.value = null
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            const { data, error: updateError } = await supabase
                .from('legal_note')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single()

            if (updateError) throw updateError

            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value[index] = data
            }

            // Re-generate embedding if content changed
            if (updates.content) {
                await generateEmbedding(data.id, data.content)
            }

            console.log('Legal note updated:', data.id)
        } catch (err) {
            console.error('Failed to update note:', err)
            error.value = '無法更新筆記'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function deleteNote(id) {
        isLoading.value = true
        error.value = null
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            // Soft delete (archive)
            const { error: deleteError } = await supabase
                .from('legal_note')
                .update({ is_archived: true })
                .eq('id', id)
                .eq('user_id', user.id)

            if (deleteError) throw deleteError

            // Remove from local state
            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value.splice(index, 1)
            }

            console.log('Legal note archived:', id)
        } catch (err) {
            console.error('Failed to delete note:', err)
            error.value = '無法刪除筆記'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function togglePin(id) {
        const note = notes.value.find(n => n.id === id)
        if (note) {
            await updateNote(id, { is_pinned: !note.is_pinned })
        }
    }

    async function generateEmbedding(noteId, content) {
        try {
            // Call Express server endpoint for embedding generation
            const response = await fetch('http://localhost:3000/api/notes/embed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    note_id: noteId,
                    content: content,
                    table: 'legal_note'
                })
            })

            if (!response.ok) {
                throw new Error(`Embedding generation failed: ${response.statusText}`)
            }

            const result = await response.json()
            console.log('Embedding generated for legal note:', noteId)
            return result
        } catch (err) {
            console.error('Error generating embedding:', err)
            // Non-blocking - don't throw error
        }
    }

    async function searchNotes(query) {
        isLoading.value = true
        error.value = null
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            // Simple text search (could be enhanced with semantic search)
            const { data, error: searchError } = await supabase
                .from('legal_note')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_archived', false)
                .or(`title.ilike.%${query}%,content.ilike.%${query}%,highlighted_text.ilike.%${query}%`)
                .order('created_at', { ascending: false })

            if (searchError) throw searchError

            return data || []
        } catch (err) {
            console.error('Failed to search notes:', err)
            error.value = '搜尋失敗'
            return []
        } finally {
            isLoading.value = false
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
        // State
        notes,
        isLoading,
        error,

        // Actions
        fetchNotes,
        addNote,
        updateNote,
        deleteNote,
        togglePin,
        generateEmbedding,
        searchNotes,

        // Getters
        pinnedNotes,
        unpinnedNotes
    }
})
