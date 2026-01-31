/**
 * Side Panel JavaScript
 * Handles authentication, theming, and AI chat functionality
 */

(function () {
    'use strict';

    const API_BASE = 'http://localhost:3000';

    // State
    let isAuthenticated = false;
    let userId = null;
    let username = null;
    let conversationId = null;
    let messages = [];

    // DOM Elements
    const loginView = document.getElementById('loginView');
    const chatView = document.getElementById('chatView');
    const loginBtn = document.getElementById('loginBtn');
    const authBadge = document.getElementById('authBadge');
    const authBadgeText = document.getElementById('authBadgeText');
    const themeToggle = document.getElementById('themeToggle');
    const messagesArea = document.getElementById('messagesArea');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Nav tabs
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    /**
     * Initialize the Side Panel
     */
    async function init() {
        console.log('Side Panel initializing...');

        // Load theme preference
        loadTheme();

        // Check authentication
        await checkAuth();

        // Setup event listeners
        setupEventListeners();
    }

    /**
     * Load theme from storage
     */
    function loadTheme() {
        chrome.storage.local.get(['theme'], (result) => {
            const theme = result.theme || 'light';
            applyTheme(theme);
        });
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        const html = document.documentElement;
        const themeIcon = themeToggle.querySelector('i');

        if (theme === 'dark') {
            html.setAttribute('data-bs-theme', 'dark');
            html.classList.add('dark');
            themeIcon.className = 'bi bi-sun-fill';
        } else {
            html.removeAttribute('data-bs-theme');
            html.classList.remove('dark');
            themeIcon.className = 'bi bi-moon-fill';
        }
    }

    /**
     * Toggle theme
     */
    function toggleTheme() {
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';

        applyTheme(newTheme);
        chrome.storage.local.set({ theme: newTheme });
    }

    /**
     * Check authentication status from storage
     */
    async function checkAuth() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['supabaseUserId', 'supabaseUserEmail', 'supabaseDisplayName'], (result) => {
                console.log('Auth check result:', result);

                if (result.supabaseUserId) {
                    isAuthenticated = true;
                    userId = result.supabaseUserId;
                    username = result.supabaseDisplayName || result.supabaseUserEmail || 'User';

                    showChatView();
                    updateAuthBadge(true, username);
                } else {
                    isAuthenticated = false;
                    userId = null;
                    username = null;

                    showLoginView();
                    updateAuthBadge(false);
                }

                resolve();
            });
        });
    }

    /**
     * Update auth badge display
     */
    function updateAuthBadge(authenticated, name = null) {
        if (authenticated && name) {
            authBadge.classList.add('authenticated');
            authBadgeText.textContent = name;
        } else {
            authBadge.classList.remove('authenticated');
            authBadgeText.textContent = '未登入';
        }
    }

    /**
     * Show login required view
     */
    function showLoginView() {
        loginView.style.display = 'flex';
        chatView.style.display = 'none';
    }

    /**
     * Show chat view
     */
    function showChatView() {
        loginView.style.display = 'none';
        chatView.style.display = 'flex';
    }

    /**
     * Open login page
     */
    function openLogin() {
        chrome.tabs.create({
            url: 'http://localhost:5173/login'
        });
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Login button
        loginBtn.addEventListener('click', openLogin);

        // Theme toggle
        themeToggle.addEventListener('click', toggleTheme);

        // Tab navigation
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                switchTab(tabId);
            });
        });

        // Send message
        sendBtn.addEventListener('click', sendMessage);

        // Enter to send (Shift+Enter for new line)
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        // Listen for auth changes from background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'AUTH_STATE_CHANGED') {
                checkAuth();
            }
        });

        // Listen for storage changes (auth updates)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.supabaseUserId || changes.supabaseDisplayName)) {
                checkAuth();
            }
        });
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabId) {
        // Update nav buttons
        navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab panels
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabId}`);
        });
    }

    /**
     * Send a message to AI
     */
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        if (!isAuthenticated) {
            addMessage('assistant', '請先登入以使用 AI 功能。');
            return;
        }

        // Add user message to UI
        addMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show loading
        sendBtn.disabled = true;
        loadingIndicator.classList.add('visible');

        try {
            // Generate conversation ID if needed
            if (!conversationId) {
                conversationId = 'conv_' + Date.now();
            }

            // Build context from previous messages
            const context = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-supabase-user-id': userId
                },
                body: JSON.stringify({
                    message: text,
                    conversationId: conversationId,
                    context: context
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    // Auth expired
                    isAuthenticated = false;
                    showLoginView();
                    updateAuthBadge(false);
                    addMessage('assistant', '登入已過期，請重新登入。');
                    return;
                }
                throw new Error(data.error || 'Failed to get response');
            }

            // Add AI response
            addMessage('assistant', data.response || data.message);

        } catch (error) {
            console.error('Chat error:', error);
            addMessage('assistant', `發生錯誤：${error.message}`);
        } finally {
            sendBtn.disabled = false;
            loadingIndicator.classList.remove('visible');
        }
    }

    /**
     * Add a message to the chat UI
     */
    function addMessage(role, content) {
        // Store in messages array
        messages.push({ role, content, timestamp: Date.now() });

        // Create message element
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.textContent = content;

        messagesArea.appendChild(msgDiv);

        // Scroll to bottom
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', init);

})();
