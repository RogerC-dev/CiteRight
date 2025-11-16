/**
 * Flashcard Handler - Connects flashcard UI to backend API
 */

class FlashcardHandler {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.currentFlashcard = null;
        this.flashcards = [];
    }

    /**
     * Get API URL
     */
    getApiUrl(endpoint) {
        return `${this.apiBase}${endpoint}`;
    }

    /**
     * Make API request
     */
    async apiRequest(endpoint, options = {}) {
        try {
            const url = this.getApiUrl(endpoint);
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * Get flashcards
     */
    async getFlashcards(filter = 'all') {
        try {
            const result = await this.apiRequest(`/flashcards?filter=${filter}`);
            if (result.success) {
                this.flashcards = result.data || [];
                return this.flashcards;
            }
            return [];
        } catch (error) {
            console.error('Error fetching flashcards:', error);
            return [];
        }
    }

    /**
     * Get due flashcards
     */
    async getDueFlashcards() {
        try {
            const result = await this.apiRequest('/flashcards/due');
            if (result.success) {
                return result.data;
            }
            return { flashcards: [], summary: { urgent: 0, soon: 0, normal: 0, total: 0 } };
        } catch (error) {
            console.error('Error fetching due flashcards:', error);
            return { flashcards: [], summary: { urgent: 0, soon: 0, normal: 0, total: 0 } };
        }
    }

    /**
     * Create flashcard
     */
    async createFlashcard(data) {
        try {
            const result = await this.apiRequest('/flashcards', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (result.success) {
                return result.data;
            }

            throw new Error(result.error || 'Failed to create flashcard');
        } catch (error) {
            console.error('Error creating flashcard:', error);
            throw error;
        }
    }

    /**
     * Review flashcard
     */
    async reviewFlashcard(flashcardId, quality) {
        try {
            const result = await this.apiRequest(`/flashcards/${flashcardId}/review`, {
                method: 'PUT',
                body: JSON.stringify({ quality })
            });

            if (result.success) {
                return result.data;
            }

            throw new Error(result.error || 'Failed to review flashcard');
        } catch (error) {
            console.error('Error reviewing flashcard:', error);
            throw error;
        }
    }

    /**
     * Delete flashcard
     */
    async deleteFlashcard(flashcardId) {
        try {
            // Note: This endpoint needs to be added to the backend
            const result = await this.apiRequest(`/flashcards/${flashcardId}`, {
                method: 'DELETE'
            });

            return result.success;
        } catch (error) {
            console.error('Error deleting flashcard:', error);
            throw error;
        }
    }

    /**
     * Create flashcard from question
     */
    async createFromQuestion(questionId, frontText, backText, tags = []) {
        return await this.createFlashcard({
            questionId,
            frontText,
            backText,
            tags
        });
    }
}

// Create global instance
window.flashcardHandler = new FlashcardHandler();

