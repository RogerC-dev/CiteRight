/**
 * OpenAI Service - Routes through the backend API server for security
 * The server handles the actual OpenAI API calls with the key from server/.env
 */

// Backend API server URL
const API_SERVER_URL = 'http://localhost:3000';

class OpenAIService {
    constructor() {
        this.model = 'gpt-4o-mini';
        this.serverUrl = API_SERVER_URL;
    }

    /**
     * Send a message through the backend AI API
     * @param {string} message - User's message
     * @param {Array} context - Previous conversation history (optional)
     * @returns {Promise<string>} - Assistant's response
     */
    async sendMessage(message, context = []) {
        if (!message || !message.trim()) {
            throw new Error('Message cannot be empty');
        }

        try {
            // Format context for the API
            const formattedContext = context.map(msg => ({
                role: msg.role || (msg.is_user ? 'user' : 'assistant'),
                content: msg.content || msg.message || ''
            }));

            const requestData = {
                message: message.trim(),
                model: this.model,
                context: formattedContext
            };

            // Use background script proxy if in content script context (bypasses CORS/PNA)
            const data = await this._makeApiCall('/api/ai/chat', 'POST', requestData);

            if (!data.success) {
                throw new Error(data.error || 'Failed to get AI response');
            }

            return data.data?.message || 'No response generated.';

        } catch (error) {
            console.error('OpenAI Service Error:', error);

            // Check if server is not running
            if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
                throw new Error('AI 服務暫時無法使用。請稍後再試。');
            }

            throw error;
        }
    }

    /**
     * Make API call - routes through background script if in content script context
     * @param {string} endpoint - API endpoint (e.g., '/api/ai/chat')
     * @param {string} method - HTTP method
     * @param {Object} body - Request body
     * @returns {Promise<Object>} - Response data
     */
    async _makeApiCall(endpoint, method = 'GET', body = null) {
        // Get stored Supabase user ID for cloud sync (set after OAuth login)
        let supabaseUserId = null;
        try {
            supabaseUserId = localStorage.getItem('precedent_supabase_user_id');
        } catch (e) {
            // localStorage may not be available in some contexts
        }

        // Check if we're in a content script context (chrome.runtime exists but window.location is external site)
        const isContentScript = typeof chrome !== 'undefined' &&
            chrome.runtime &&
            chrome.runtime.sendMessage &&
            window.location.protocol !== 'chrome-extension:';

        if (isContentScript) {
            // Route through background script to bypass CORS/Private Network Access
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'API_REQUEST',
                    endpoint: endpoint,
                    method: method,
                    body: body,
                    supabaseUserId: supabaseUserId // Pass to background for header injection
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response || !response.success) {
                        reject(new Error(response?.error || 'API request failed'));
                        return;
                    }
                    resolve(response.data);
                });
            });
        }

        // Direct fetch (popup context or non-extension)
        const headers = {
            'Content-Type': 'application/json'
        };

        // Add Supabase user ID header if available for cloud sync
        if (supabaseUserId) {
            headers['x-supabase-user-id'] = supabaseUserId;
        }

        const response = await fetch(`${this.serverUrl}${endpoint}`, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Analyze a legal case through the backend
     * @param {string} text - Case text to analyze
     * @returns {Promise<string>} - Analysis result
     */
    async analyzeCase(text) {
        try {
            const response = await fetch(`${this.serverUrl}/api/ai/analyze-case`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model: this.model
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to analyze case');
            }

            return data.data?.analysis || 'No analysis generated.';

        } catch (error) {
            console.error('Case Analysis Error:', error);
            throw error;
        }
    }

    /**
     * Get chat history from the server
     * @param {string} conversationId - Optional conversation ID
     * @param {number} limit - Max messages to retrieve
     * @returns {Promise<Array>} - Chat history
     */
    async getHistory(conversationId = null, limit = 50) {
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (conversationId) {
                params.append('conversationId', conversationId);
            }

            const response = await fetch(`${this.serverUrl}/api/ai/history?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];

        } catch (error) {
            console.error('Get History Error:', error);
            // Return empty array on error (history is optional)
            return [];
        }
    }

    /**
     * Set the model to use
     * @param {string} model - Model name (gpt-4o-mini, gpt-4, etc.)
     */
    setModel(model) {
        this.model = model;
    }

    /**
     * Set the server URL
     * @param {string} url - Server base URL
     */
    setServerUrl(url) {
        this.serverUrl = url;
    }
}

export const openaiService = new OpenAIService();
export default openaiService;
