import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useNoteStore = defineStore('notes', () => {
    // State
    const notes = ref([])
    const isLoading = ref(false)
    const error = ref(null)

    // Helper: Get userId from chrome.storage
    async function getUserId() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['supabaseUserId'], (result) => {
                resolve(result.supabaseUserId || null);
            });
        });
    }

    // Helper: Call server API via background script proxy
    async function callAPI(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                endpoint: endpoint,
                method: options.method || 'GET',
                body: options.body,
                headers: options.headers || {}
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response.success) {
                    // Unwrap the server response (background.js wraps it in another layer)
                    const serverResponse = response.data;
                    if (serverResponse && serverResponse.success) {
                        resolve(serverResponse.data);
                    } else if (serverResponse && serverResponse.error) {
                        reject(new Error(serverResponse.error));
                    } else {
                        resolve(serverResponse);
                    }
                } else {
                    reject(new Error(response.error || 'API request failed'));
                }
            });
        });
    }

    // Actions
    async function fetchNotes(filters = {}) {
        isLoading.value = true
        error.value = null
        try {
            const userId = await getUserId();
            if (!userId) {
                console.log('No authenticated user, skipping note fetch')
                notes.value = []
                return
            }

            const queryParams = new URLSearchParams();
            if (filters.source_type) {
                queryParams.append('source_type', filters.source_type);
            }
            if (filters.source_id) {
                queryParams.append('source_id', filters.source_id);
            }

            const data = await callAPI(`/api/notes?${queryParams.toString()}`);
            notes.value = data || []
            console.log(`Loaded ${notes.value.length} legal notes from server`)
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
            const userId = await getUserId();
            if (!userId) {
                throw new Error('User not authenticated')
            }

            const data = await callAPI('/api/notes', {
                method: 'POST',
                body: noteData
            });

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
            const userId = await getUserId();
            if (!userId) {
                throw new Error('User not authenticated')
            }

            console.log('📤 Sending update request for note:', id, updates);
            const data = await callAPI(`/api/notes/${id}`, {
                method: 'PATCH',
                body: updates
            });

            console.log('✅ Note update response:', data);

            const index = notes.value.findIndex(n => n.id === id)
            if (index !== -1) {
                notes.value[index] = data
            }

            // Re-generate embedding if content changed
            if (updates.content) {
                generateEmbedding(data.id, data.content).catch(err => {
                    console.error('Failed to generate embedding:', err)
                })
            }

            console.log('✅ Legal note updated:', data.id)
            return data
        } catch (err) {
            console.error('❌ Failed to update note:', err)
            error.value = '無法更新筆記: ' + (err.message || '未知錯誤')
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function deleteNote(id) {
        isLoading.value = true
        error.value = null
        try {
            const userId = await getUserId();
            if (!userId) {
                throw new Error('User not authenticated')
            }

            await callAPI(`/api/notes/${id}`, {
                method: 'DELETE'
            });

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
            // Call server API via background proxy for embedding generation
            await callAPI('/api/notes/embed', {
                method: 'POST',
                body: {
                    note_id: noteId,
                    content: content,
                    table: 'legal_note'
                }
            });

            console.log('Embedding generated for legal note:', noteId)
        } catch (err) {
            console.error('Error generating embedding:', err)
            // Non-blocking - don't throw error
        }
    }

    async function searchNotes(query) {
        isLoading.value = true
        error.value = null
        try {
            const userId = await getUserId();
            if (!userId) {
                throw new Error('User not authenticated')
            }

            // Simple text search on local notes
            // In the future, this could be enhanced with a server-side semantic search endpoint
            const searchLower = query.toLowerCase();
            const results = notes.value.filter(note => {
                return (
                    (note.title && note.title.toLowerCase().includes(searchLower)) ||
                    (note.content && note.content.toLowerCase().includes(searchLower)) ||
                    (note.highlighted_text && note.highlighted_text.toLowerCase().includes(searchLower))
                );
            });

            return results;
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
