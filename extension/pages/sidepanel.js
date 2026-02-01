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
    // authBadgeText was removed from HTML, so we handle it gracefully
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
        const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

        if (theme === 'dark') {
            html.setAttribute('data-bs-theme', 'dark');
            html.classList.add('dark');
            if (themeIcon) themeIcon.className = 'bi bi-sun-fill';
        } else {
            html.removeAttribute('data-bs-theme');
            html.classList.remove('dark');
            if (themeIcon) themeIcon.className = 'bi bi-moon-fill';
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
            // First try getting from storage (fastest)
            chrome.storage.local.get(['supabaseUserId', 'supabaseUserEmail', 'supabaseDisplayName'], (result) => {
                console.log('Auth check result:', result);

                if (result.supabaseUserId) {
                    isAuthenticated = true;
                    userId = result.supabaseUserId;
                    username = result.supabaseDisplayName || result.supabaseUserEmail || 'User';

                    showChatView();
                    updateAuthBadge(true, username);
                } else {
                    // If not found, try asking background explicitly (backup)
                    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (bgResult) => {
                        if (bgResult && bgResult.isAuthenticated) {
                            isAuthenticated = true;
                            userId = bgResult.userId;
                            username = bgResult.displayName || bgResult.email || 'User';
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
                    return; // Wait for fallback
                }

                resolve();
            });
        });
    }

    /**
     * Update auth badge display
     */
    function updateAuthBadge(authenticated, name = null) {
        if (!authBadge) return;

        if (authenticated) {
            authBadge.classList.add('authenticated');
            // Tooltip only, no extra icons
            authBadge.title = `已登入：${name} (點擊登出)`;

            // Ensure icon is correct (always person-circle, just color changes)
            const icon = authBadge.querySelector('i');
            if (icon) icon.className = 'bi bi-person-circle';

        } else {
            authBadge.classList.remove('authenticated');
            authBadge.title = '點擊登入';

            const icon = authBadge.querySelector('i');
            if (icon) icon.className = 'bi bi-person-circle';
        }
    }

    /**
     * Handle Auth Badge Click
     */
    function handleAuthClick() {
        if (isAuthenticated) {
            // Confirm logout
            const confirmLogout = confirm('您確定要登出 CiteRight 嗎？'); // Simple confirm for now
            if (confirmLogout) {
                // Clear local extensions storage
                chrome.runtime.sendMessage({ type: 'LOGOUT' }, (response) => {
                    checkAuth(); // Update UI
                    // Optional: Open web app logout page if needed, but user said "no need to go to that examweb"
                    // chrome.tabs.create({ url: 'http://localhost:5173/logout' }); 
                });
            }
        } else {
            // Open login page
            openLogin();
        }
    }

    /**
     * Show login required view
     */
    function showLoginView() {
        if (loginView) loginView.style.display = 'flex';
        if (chatView) chatView.style.display = 'none';

        // Also enable/disable chat input
        if (chatInput) chatInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
    }

    /**
     * Show chat view
     */
    function showChatView() {
        if (loginView) loginView.style.display = 'none';
        if (chatView) chatView.style.display = 'flex';

        if (chatInput) chatInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
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
        if (loginBtn) loginBtn.addEventListener('click', openLogin);

        // Auth Badge Click
        if (authBadge) authBadge.addEventListener('click', handleAuthClick);

        // Theme toggle
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

        // Tab navigation
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                switchTab(tabId);
            });
        });

        // Send message
        if (sendBtn) sendBtn.addEventListener('click', sendMessage);

        // Enter to send (Shift+Enter for new line)
        if (chatInput) {
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
        }

        // Listen for auth changes from background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'AUTH_STATE_CHANGED' || message.type === 'AUTH_SUCCESS_FROM_PAGE') {
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
        console.log('Switching to tab:', tabId);

        // Update nav buttons
        navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab panels
        tabPanels.forEach(panel => {
            const isActive = panel.id === `tab-${tabId}`;
            panel.classList.toggle('active', isActive);
            // panel.style.display = isActive ? 'flex' : 'none'; // Ensure display is updated if CSS fails
        });
    }

    /**
     * Send a message to AI
     */
    async function sendMessage() {
        if (!chatInput) return;

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
        if (sendBtn) sendBtn.disabled = true;
        if (loadingIndicator) loadingIndicator.classList.add('visible');

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
            if (sendBtn) sendBtn.disabled = false;
            if (loadingIndicator) loadingIndicator.classList.remove('visible');
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

        if (messagesArea) {
            messagesArea.appendChild(msgDiv);
            // Scroll to bottom
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', init);

})();
