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

            const response = await fetch(`${this.serverUrl}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message.trim(),
                    model: this.model,
                    context: formattedContext
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('AI API Error:', errorData);
                throw new Error(errorData.error || `API Error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to get AI response');
            }

            return data.data?.message || 'No response generated.';

        } catch (error) {
            console.error('OpenAI Service Error:', error);
            
            // Check if server is not running
            if (error.message.includes('fetch') || error.message.includes('network')) {
                throw new Error('AI 伺服器未連線。請確認伺服器正在運行。');
            }
            
            throw error;
        }
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
