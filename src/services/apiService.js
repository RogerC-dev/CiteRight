/**
 * API Service for ExamQuestionBank Integration
 * Provides methods to interact with the ExamQuestionBank backend
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = null;
    this.refreshToken = null;
  }

  // Token management
  setTokens(accessToken, refreshToken = null) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        'examqb_access_token': accessToken,
        'examqb_refresh_token': refreshToken
      });
    } else {
      localStorage.setItem('examqb_access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('examqb_refresh_token', refreshToken);
      }
    }
  }

  async loadTokens() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['examqb_access_token', 'examqb_refresh_token'], (result) => {
          this.token = result.examqb_access_token || null;
          this.refreshToken = result.examqb_refresh_token || null;
          resolve({ token: this.token, refreshToken: this.refreshToken });
        });
      });
    } else {
      this.token = localStorage.getItem('examqb_access_token');
      this.refreshToken = localStorage.getItem('examqb_refresh_token');
      return { token: this.token, refreshToken: this.refreshToken };
    }
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['examqb_access_token', 'examqb_refresh_token']);
    } else {
      localStorage.removeItem('examqb_access_token');
      localStorage.removeItem('examqb_refresh_token');
    }
  }

  isAuthenticated() {
    return !!this.token;
  }

  // Base request method
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          headers['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
          });
          if (!retryResponse.ok) {
            throw new Error(`API Error: ${retryResponse.status}`);
          }
          return retryResponse.json();
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.detail || `API Error: ${response.status}`);
      }

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access, data.refresh || this.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    this.clearTokens();
    return false;
  }

  // Authentication endpoints
  async login(username, password) {
    const response = await this.request('/auth/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (response && response.access) {
      this.setTokens(response.access, response.refresh);
    }
    return response;
  }

  async logout() {
    this.clearTokens();
    return true;
  }

  async register(userData) {
    return this.request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/user/');
  }

  // Flashcard endpoints
  async getFlashcards(filter = '') {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    return this.request(`/flashcards/${query}`);
  }

  async getFlashcard(flashcardId) {
    return this.request(`/flashcards/${flashcardId}/`);
  }

  async getDueFlashcards() {
    return this.request('/flashcards/due/');
  }

  async createFlashcard(data) {
    return this.request('/flashcards/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFlashcard(flashcardId, data) {
    return this.request(`/flashcards/${flashcardId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFlashcard(flashcardId) {
    return this.request(`/flashcards/${flashcardId}/`, {
      method: 'DELETE',
    });
  }

  async reviewFlashcard(flashcardId, quality) {
    return this.request(`/flashcards/${flashcardId}/review/`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    });
  }

  async getFlashcardStats() {
    return this.request('/flashcards/stats/');
  }

  // Quiz endpoints
  async getQuizStats() {
    return this.request('/quiz/stats/');
  }

  async startPracticeSession(mode, filters = {}) {
    return this.request('/quiz/start-session/', {
      method: 'POST',
      body: JSON.stringify({ mode, filters }),
    });
  }

  async submitAnswer(sessionId, questionId, answer) {
    return this.request(`/quiz/sessions/${sessionId}/submit/`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer }),
    });
  }

  // Analytics endpoints
  async getAnalyticsProgress(timeRange = '7d') {
    return this.request(`/analytics/progress/?time_range=${timeRange}`);
  }

  async getAnalyticsSubjectBreakdown() {
    return this.request('/analytics/subject-breakdown/');
  }

  async getAnalyticsWrongQuestions(limit = 10) {
    return this.request(`/analytics/wrong-questions/?limit=${limit}`);
  }

  async getAnalyticsDashboard() {
    return this.request('/analytics/dashboard/');
  }

  // AI Chat endpoints
  async sendChatMessage(message, conversationId = null) {
    return this.request('/ai/chat/', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
  }

  async getChatHistory(conversationId) {
    return this.request(`/ai/chat/history/${conversationId}/`);
  }

  async getConversations() {
    return this.request('/ai/conversations/');
  }

  async createConversation(title = null) {
    return this.request('/ai/conversations/', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async deleteConversation(conversationId) {
    return this.request(`/ai/conversations/${conversationId}/`, {
      method: 'DELETE',
    });
  }

  // Questions endpoints
  async getQuestions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/questions/${query ? '?' + query : ''}`);
  }

  async getQuestion(questionId) {
    return this.request(`/questions/${questionId}/`);
  }

  // Subjects endpoints
  async getSubjects() {
    return this.request('/subjects/');
  }

  // Precedent API endpoints (for legal data - uses different base URL)
  async fetchInterpretation(number) {
    // Use Precedent API server (port 3000) instead of ExamQuestionBank
    const PRECEDENT_API_URL = 'http://localhost:3000';
    try {
      const response = await fetch(`${PRECEDENT_API_URL}/api/case?caseType=釋字&number=${encodeURIComponent(number)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.detail || `API Error: ${response.status}`);
      }
      const data = await response.json();
      // Return the data in the expected format
      return data.data || data;
    } catch (error) {
      console.error('Fetch interpretation error:', error);
      throw error;
    }
  }

  async fetchLawInfo(lawName) {
    // Use Precedent API server (port 3000) instead of ExamQuestionBank
    const PRECEDENT_API_URL = 'http://localhost:3000';
    try {
      // Try direct law name lookup first
      let response = await fetch(`${PRECEDENT_API_URL}/api/laws/${encodeURIComponent(lawName)}`);
      
      // If not found, try search endpoint
      if (!response.ok && response.status === 404) {
        response = await fetch(`${PRECEDENT_API_URL}/api/laws/search?q=${encodeURIComponent(lawName)}`);
        if (response.ok) {
          const searchData = await response.json();
          // If search returns results, use the first match
          if (searchData.success && searchData.data && searchData.data.length > 0) {
            const firstMatch = searchData.data[0];
            // Try to get full details using the law name from search result
            response = await fetch(`${PRECEDENT_API_URL}/api/laws/${encodeURIComponent(firstMatch.lawName || firstMatch.name || lawName)}`);
          }
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.detail || `API Error: ${response.status}`);
      }
      
      const data = await response.json();
      // Return the data in the expected format
      return data.data || data;
    } catch (error) {
      console.error('Fetch law info error:', error);
      throw error;
    }
  }

  async loadLegalNames() {
    // Use Precedent API server (port 3000) instead of ExamQuestionBank
    const PRECEDENT_API_URL = 'http://localhost:3000';
    try {
      const response = await fetch(`${PRECEDENT_API_URL}/api/laws/`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.detail || `API Error: ${response.status}`);
      }
      const data = await response.json();
      // API returns { success: true, data: [array of law name strings] }
      // Return array of strings for the highlighter
      return data.success && data.data ? data.data : [];
    } catch (error) {
      console.error('Load legal names error:', error);
      // Return empty array on error to allow graceful degradation
      return [];
    }
  }

  async searchLegalData(query, options = {}) {
    // Use Precedent API server (port 3000) instead of ExamQuestionBank
    const PRECEDENT_API_URL = 'http://localhost:3000';
    try {
      const { type = 'law' } = options;
      let response;
      
      if (type === 'law') {
        // Search laws
        response = await fetch(`${PRECEDENT_API_URL}/api/laws/search?q=${encodeURIComponent(query)}`);
      } else if (type === 'interpretation' || type === '釋字') {
        // Search interpretations
        response = await fetch(`${PRECEDENT_API_URL}/api/case/search?q=${encodeURIComponent(query)}&type=interpretation`);
      } else {
        throw new Error(`Unsupported search type: ${type}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.detail || `API Error: ${response.status}`);
      }
      
      const data = await response.json();
      // Return the data array
      return data.success && data.data ? data.data : [];
    } catch (error) {
      console.error('Search legal data error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;

// Export individual functions for backward compatibility
export const fetchInterpretation = (number) => apiService.fetchInterpretation(number);
export const fetchLawInfo = (lawName) => apiService.fetchLawInfo(lawName);
export const loadLegalNames = () => apiService.loadLegalNames();
export const searchLegalData = (query, options) => apiService.searchLegalData(query, options);
