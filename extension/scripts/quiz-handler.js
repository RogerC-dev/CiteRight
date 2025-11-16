/**
 * Quiz Handler - Connects quiz bank UI to backend API
 */

class QuizHandler {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.currentSession = null;
        this.currentQuestionIndex = 0;
        this.questions = [];
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
     * Get questions with filters
     */
    async getQuestions(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });

        const result = await this.apiRequest(`/quiz/questions?${params.toString()}`);
        return result.data || [];
    }

    /**
     * Start practice session
     */
    async startPractice(mode, filters = {}) {
        try {
            const result = await this.apiRequest('/quiz/practice', {
                method: 'POST',
                body: JSON.stringify({
                    mode,
                    ...filters
                })
            });

            if (result.success) {
                this.currentSession = result.data.sessionId;
                this.questions = result.data.questions;
                this.currentQuestionIndex = 0;
                return result.data;
            }

            throw new Error(result.error || 'Failed to start practice session');
        } catch (error) {
            console.error('Error starting practice:', error);
            throw error;
        }
    }

    /**
     * Submit answer
     */
    async submitAnswer(questionId, answer) {
        if (!this.currentSession) {
            throw new Error('No active practice session');
        }

        try {
            const result = await this.apiRequest('/quiz/submit', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: this.currentSession,
                    questionId,
                    answer
                })
            });

            return result.data;
        } catch (error) {
            console.error('Error submitting answer:', error);
            throw error;
        }
    }

    /**
     * Get user statistics
     */
    async getStats() {
        try {
            const result = await this.apiRequest('/quiz/stats');
            return result.data || {};
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {
                totalQuestions: 0,
                practiced: 0,
                accuracy: 0,
                correct: 0,
                totalAttempts: 0,
                toReview: 0
            };
        }
    }

    /**
     * Get current question
     */
    getCurrentQuestion() {
        if (this.questions.length === 0 || this.currentQuestionIndex >= this.questions.length) {
            return null;
        }
        return this.questions[this.currentQuestionIndex];
    }

    /**
     * Move to next question
     */
    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            return true;
        }
        return false;
    }

    /**
     * Move to previous question
     */
    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            return true;
        }
        return false;
    }

    /**
     * Get progress
     */
    getProgress() {
        if (this.questions.length === 0) {
            return { current: 0, total: 0, percentage: 0 };
        }
        return {
            current: this.currentQuestionIndex + 1,
            total: this.questions.length,
            percentage: Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100)
        };
    }
}

// Create global instance
window.quizHandler = new QuizHandler();

