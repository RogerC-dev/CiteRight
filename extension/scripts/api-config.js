/**
 * API Configuration for Precedent Extension
 * Connects to ExamQuestionBank backend
 */

const API_CONFIG = {
  // Development URL
  baseUrl: 'http://localhost:8000/api/v1',
  
  // Production URL (update when deploying)
  // baseUrl: 'https://your-domain.com/api/v1',

  // API Endpoints
  endpoints: {
    // Authentication
    auth: {
      login: '/auth/login/',
      logout: '/auth/logout/',
      refresh: '/auth/refresh/',
      register: '/auth/register/',
      me: '/users/me/',
    },
    
    // Flashcards
    flashcards: {
      list: '/flashcards/',
      detail: (id) => `/flashcards/${id}/`,
      create: '/flashcards/',
      update: (id) => `/flashcards/${id}/`,
      delete: (id) => `/flashcards/${id}/`,
      due: '/flashcards/due/',
      stats: '/flashcards/stats/',
      review: (id) => `/flashcards/${id}/review/`,
      settings: '/flashcards/settings/',
      decks: '/flashcards/decks/',
      deckDetail: (id) => `/flashcards/decks/${id}/`,
    },
    
    // Questions
    questions: {
      list: '/questions/',
      detail: (id) => `/questions/${id}/`,
      random: '/questions/random/',
      subjects: '/questions/subjects/',
    },
    
    // Exams & Practice
    exams: {
      list: '/exams/',
      detail: (id) => `/exams/${id}/`,
      start: (id) => `/exams/${id}/start/`,
      submit: (id) => `/exams/${id}/submit/`,
    },
    
    // Bookmarks
    bookmarks: {
      list: '/bookmarks/',
      create: '/bookmarks/',
      delete: (id) => `/bookmarks/${id}/`,
    },
    
    // Analytics
    analytics: {
      dashboard: '/analytics/dashboard/',
      progress: '/analytics/progress/',
      stats: '/analytics/stats/',
    },
  },

  // Request timeout (ms)
  timeout: 30000,
};

/**
 * API Service for making authenticated requests
 */
const ApiService = {
  /**
   * Get stored auth token
   */
  getToken: function() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['auth_token'], (result) => {
          resolve(result.auth_token || null);
        });
      } else {
        resolve(localStorage.getItem('auth_token'));
      }
    });
  },

  /**
   * Store auth token
   */
  setToken: function(token) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ auth_token: token });
    } else {
      localStorage.setItem('auth_token', token);
    }
  },

  /**
   * Remove auth token
   */
  removeToken: function() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['auth_token']);
    } else {
      localStorage.removeItem('auth_token');
    }
  },

  /**
   * Get stored refresh token
   */
  getRefreshToken: function() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['refresh_token'], (result) => {
          resolve(result.refresh_token || null);
        });
      } else {
        resolve(localStorage.getItem('refresh_token'));
      }
    });
  },

  /**
   * Store refresh token
   */
  setRefreshToken: function(token) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ refresh_token: token });
    } else {
      localStorage.setItem('refresh_token', token);
    }
  },

  /**
   * Build full URL
   */
  buildUrl: function(endpoint) {
    return `${API_CONFIG.baseUrl}${endpoint}`;
  },

  /**
   * Make authenticated request
   */
  request: async function(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(this.buildUrl(endpoint), config);
      
      // Handle 401 - try to refresh token
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry with new token
          headers['Authorization'] = `Bearer ${await this.getToken()}`;
          return fetch(this.buildUrl(endpoint), { ...config, headers });
        }
      }

      return response;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  },

  /**
   * Refresh authentication token
   */
  refreshToken: async function() {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(this.buildUrl(API_CONFIG.endpoints.auth.refresh), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    this.removeToken();
    return false;
  },

  /**
   * GET request
   */
  get: function(endpoint, params = {}) {
    const url = new URL(this.buildUrl(endpoint));
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return this.request(endpoint + (url.search || ''), { method: 'GET' });
  },

  /**
   * POST request
   */
  post: function(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT request
   */
  put: function(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * PATCH request
   */
  patch: function(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * DELETE request
   */
  delete: function(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async function() {
    const token = await this.getToken();
    return !!token;
  },

  /**
   * Login user
   */
  login: async function(username, password) {
    const response = await fetch(this.buildUrl(API_CONFIG.endpoints.auth.login), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      this.setToken(data.access);
      this.setRefreshToken(data.refresh);
      return { success: true, data };
    }

    const error = await response.json();
    return { success: false, error };
  },

  /**
   * Logout user
   */
  logout: function() {
    this.removeToken();
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['refresh_token']);
    } else {
      localStorage.removeItem('refresh_token');
    }
  },
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, ApiService };
}
