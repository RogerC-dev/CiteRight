/**
 * Flashcard Handler - Connects flashcard UI to ExamQuestionBank API
 * Uses ApiService for authenticated requests
 */

class FlashcardHandler {
  constructor() {
    this.currentFlashcard = null;
    this.flashcards = [];
    this.stats = null;
    this.settings = null;
    this.decks = [];
    this.listeners = {};
  }

  /**
   * Get flashcard API endpoints from API_CONFIG
   */
  get endpoints() {
    return API_CONFIG.endpoints.flashcards;
  }

  /**
   * Subscribe to events
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    return await ApiService.isAuthenticated();
  }

  /**
   * Get all flashcards with optional filters
   * @param {Object} filters - { deck, status, tag, search, ordering }
   */
  async getFlashcards(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.deck) params.append('deck', filters.deck);
      if (filters.status) params.append('status', filters.status);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.search) params.append('search', filters.search);
      if (filters.ordering) params.append('ordering', filters.ordering);
      if (filters.page) params.append('page', filters.page);
      if (filters.page_size) params.append('page_size', filters.page_size);

      const queryString = params.toString();
      const endpoint = this.endpoints.list + (queryString ? `?${queryString}` : '');
      
      const response = await ApiService.request(endpoint, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        // Handle paginated response
        this.flashcards = data.results || data;
        this.emit('flashcardsLoaded', this.flashcards);
        return {
          success: true,
          data: this.flashcards,
          count: data.count || this.flashcards.length,
          next: data.next,
          previous: data.previous,
        };
      }

      throw new Error(`Failed to fetch flashcards: ${response.status}`);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      this.emit('error', { action: 'getFlashcards', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get single flashcard by ID
   */
  async getFlashcard(id) {
    try {
      const response = await ApiService.request(this.endpoints.detail(id), { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      throw new Error(`Failed to fetch flashcard: ${response.status}`);
    } catch (error) {
      console.error('Error fetching flashcard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get flashcards due for review
   */
  async getDueFlashcards() {
    try {
      const response = await ApiService.request(this.endpoints.due, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        const dueCards = data.results || data;
        this.emit('dueFlashcardsLoaded', dueCards);
        return {
          success: true,
          data: {
            flashcards: dueCards,
            summary: {
              total: dueCards.length,
              urgent: dueCards.filter(c => c.urgency === 'urgent').length,
              soon: dueCards.filter(c => c.urgency === 'soon').length,
              normal: dueCards.filter(c => c.urgency === 'normal').length,
            }
          }
        };
      }

      throw new Error(`Failed to fetch due flashcards: ${response.status}`);
    } catch (error) {
      console.error('Error fetching due flashcards:', error);
      return { 
        success: false, 
        error: error.message,
        data: { flashcards: [], summary: { urgent: 0, soon: 0, normal: 0, total: 0 } }
      };
    }
  }

  /**
   * Get flashcard statistics
   */
  async getStats() {
    try {
      const response = await ApiService.request(this.endpoints.stats, { method: 'GET' });
      
      if (response.ok) {
        this.stats = await response.json();
        this.emit('statsLoaded', this.stats);
        return { success: true, data: this.stats };
      }

      throw new Error(`Failed to fetch stats: ${response.status}`);
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { 
        success: false, 
        error: error.message,
        data: {
          total_cards: 0,
          mastered: 0,
          learning: 0,
          new: 0,
          due_today: 0,
          retention_rate: 0,
          streak: 0,
        }
      };
    }
  }

  /**
   * Create new flashcard
   * @param {Object} data - { front, back, deck, tags, source_question }
   */
  async createFlashcard(data) {
    try {
      const response = await ApiService.post(this.endpoints.create, data);
      
      if (response.ok) {
        const created = await response.json();
        this.flashcards.push(created);
        this.emit('flashcardCreated', created);
        return { success: true, data: created };
      }

      const error = await response.json();
      throw new Error(error.detail || 'Failed to create flashcard');
    } catch (error) {
      console.error('Error creating flashcard:', error);
      this.emit('error', { action: 'createFlashcard', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update flashcard
   */
  async updateFlashcard(id, data) {
    try {
      const response = await ApiService.patch(this.endpoints.update(id), data);
      
      if (response.ok) {
        const updated = await response.json();
        const index = this.flashcards.findIndex(f => f.id === id);
        if (index !== -1) {
          this.flashcards[index] = updated;
        }
        this.emit('flashcardUpdated', updated);
        return { success: true, data: updated };
      }

      const error = await response.json();
      throw new Error(error.detail || 'Failed to update flashcard');
    } catch (error) {
      console.error('Error updating flashcard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete flashcard
   */
  async deleteFlashcard(id) {
    try {
      const response = await ApiService.delete(this.endpoints.delete(id));
      
      if (response.ok || response.status === 204) {
        this.flashcards = this.flashcards.filter(f => f.id !== id);
        this.emit('flashcardDeleted', { id });
        return { success: true };
      }

      throw new Error(`Failed to delete flashcard: ${response.status}`);
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Review flashcard with quality rating
   * @param {number} id - Flashcard ID
   * @param {number} quality - Rating 1-5 (1=Again, 2=Hard, 3=Good, 4=Easy, 5=Perfect)
   */
  async reviewFlashcard(id, quality) {
    try {
      const response = await ApiService.post(this.endpoints.review(id), { quality });
      
      if (response.ok) {
        const result = await response.json();
        this.emit('flashcardReviewed', { id, quality, result });
        return { success: true, data: result };
      }

      const error = await response.json();
      throw new Error(error.detail || 'Failed to review flashcard');
    } catch (error) {
      console.error('Error reviewing flashcard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get flashcard settings
   */
  async getSettings() {
    try {
      const response = await ApiService.request(this.endpoints.settings, { method: 'GET' });
      
      if (response.ok) {
        this.settings = await response.json();
        return { success: true, data: this.settings };
      }

      throw new Error(`Failed to fetch settings: ${response.status}`);
    } catch (error) {
      console.error('Error fetching settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update flashcard settings
   */
  async updateSettings(settings) {
    try {
      const response = await ApiService.patch(this.endpoints.settings, settings);
      
      if (response.ok) {
        this.settings = await response.json();
        return { success: true, data: this.settings };
      }

      throw new Error(`Failed to update settings: ${response.status}`);
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all decks
   */
  async getDecks() {
    try {
      const response = await ApiService.request(this.endpoints.decks, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        this.decks = data.results || data;
        this.emit('decksLoaded', this.decks);
        return { success: true, data: this.decks };
      }

      throw new Error(`Failed to fetch decks: ${response.status}`);
    } catch (error) {
      console.error('Error fetching decks:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Create deck
   */
  async createDeck(name, description = '') {
    try {
      const response = await ApiService.post(this.endpoints.decks, { name, description });
      
      if (response.ok) {
        const deck = await response.json();
        this.decks.push(deck);
        this.emit('deckCreated', deck);
        return { success: true, data: deck };
      }

      const error = await response.json();
      throw new Error(error.detail || 'Failed to create deck');
    } catch (error) {
      console.error('Error creating deck:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create flashcard from question (convenience method)
   */
  async createFromQuestion(questionId, front, back, tags = [], deckId = null) {
    return await this.createFlashcard({
      front,
      back,
      tags,
      deck: deckId,
      source_question: questionId,
    });
  }

  /**
   * Start a review session
   * Returns the first due card or null if none
   */
  async startReviewSession() {
    const result = await this.getDueFlashcards();
    if (result.success && result.data.flashcards.length > 0) {
      this.currentFlashcard = result.data.flashcards[0];
      this.emit('reviewSessionStarted', {
        currentCard: this.currentFlashcard,
        totalDue: result.data.flashcards.length,
      });
      return { success: true, data: this.currentFlashcard };
    }
    return { success: true, data: null, message: 'No cards due for review' };
  }

  /**
   * Get next card in review session
   */
  async getNextCard() {
    const result = await this.getDueFlashcards();
    if (result.success && result.data.flashcards.length > 0) {
      this.currentFlashcard = result.data.flashcards[0];
      return { success: true, data: this.currentFlashcard };
    }
    this.currentFlashcard = null;
    this.emit('reviewSessionCompleted');
    return { success: true, data: null, message: 'Review session completed' };
  }

  /**
   * Quick add flashcard with minimal data
   */
  async quickAdd(front, back) {
    return await this.createFlashcard({ front, back });
  }
}

// Create global instance
window.flashcardHandler = new FlashcardHandler();
