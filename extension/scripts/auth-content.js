/**
 * Auth Content Script - Reads authentication from ExamQuestionBank pages
 * 
 * This runs on ExamQuestionBank pages to detect and relay auth data
 * back to the extension.
 */

(function () {
    'use strict';

    // Only run on ExamQuestionBank
    if (!window.location.href.includes('localhost:5173') &&
        !window.location.href.includes('ExamQuestionBank')) {
        return;
    }

    console.log('🔐 Auth content script running on ExamQuestionBank');

    /**
     * Check for auth success data stored by AuthCallbackView
     */
    function checkForAuthSuccess() {
        try {
            const authData = localStorage.getItem('precedent_auth_success');
            if (authData) {
                const parsed = JSON.parse(authData);

                // Only process if recent (within last 30 seconds)
                if (Date.now() - parsed.timestamp < 30000) {
                    console.log('✅ Found auth success data, relaying to extension');

                    // Send to extension
                    chrome.runtime.sendMessage({
                        type: 'AUTH_SUCCESS_FROM_PAGE',
                        data: parsed
                    });

                    // Clear the flag
                    localStorage.removeItem('precedent_auth_success');
                }
            }
        } catch (err) {
            console.warn('Auth check error:', err);
        }
    }

    /**
     * Listen for BroadcastChannel messages
     */
    function listenForBroadcast() {
        try {
            const channel = new BroadcastChannel('precedent_auth');
            channel.onmessage = (event) => {
                if (event.data && event.data.type === 'AUTH_SUCCESS') {
                    console.log('📡 Received auth broadcast:', event.data);

                    // Relay to extension background
                    chrome.runtime.sendMessage({
                        type: 'AUTH_SUCCESS_FROM_PAGE',
                        data: event.data
                    });
                }
            };
        } catch (err) {
            // BroadcastChannel not available in content scripts
            console.warn('BroadcastChannel not available:', err);
        }
    }

    /**
     * Get current session from Supabase (if user is logged in)
     */
    async function checkCurrentSession() {
        try {
            // Check localStorage for Supabase session
            const sbAccessToken = localStorage.getItem('sb-access-token');
            const userId = localStorage.getItem('user_id');
            const username = localStorage.getItem('username');

            if (userId) {
                console.log('👤 Found existing ExamQuestionBank session:', username);

                // Relay to extension
                chrome.runtime.sendMessage({
                    type: 'EXISTING_SESSION_FOUND',
                    data: {
                        userId: userId,
                        displayName: username,
                        email: null // Not available from localStorage
                    }
                });
            }
        } catch (err) {
            console.warn('Session check error:', err);
        }
    }

    // Run checks
    checkForAuthSuccess();
    listenForBroadcast();

    // Check on page load after a small delay
    setTimeout(checkCurrentSession, 1000);

    // Also check when returning to the page
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkForAuthSuccess();
        }
    });

    // Listen for logout (localStorage changes)
    window.addEventListener('storage', (event) => {
        if (event.key === 'user_id' && event.newValue === null) {
            console.log('Logout detected, clearing extension auth');
            chrome.runtime.sendMessage({ type: 'LOGOUT' });
        }
    });

    // Also check if user_id was removed directly (same window)
    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function (key) {
        if (key === 'user_id') {
            console.log('Logout detected (same window), clearing extension auth');
            chrome.runtime.sendMessage({ type: 'LOGOUT' });
        }
        originalRemoveItem.apply(this, arguments);
    };

    // =================================
    // Listen for web app messages to open Side Panel
    // =================================
    window.addEventListener('message', (event) => {
        // Only accept messages from same origin (ExamQuestionBank)
        if (event.origin !== window.location.origin) return;

        if (event.data && event.data.type === 'CITERIGHT_OPEN_SIDE_PANEL') {
            console.log('Received OPEN_SIDE_PANEL from web app');
            chrome.runtime.sendMessage({
                type: 'OPEN_SIDE_PANEL',
                context: event.data.context || null
            });
        }
    });

    // Inject marker element for web app to detect extension
    const marker = document.createElement('div');
    marker.id = 'citeright-extension-marker';
    marker.style.display = 'none';
    marker.dataset.version = '2.0';
    document.body.appendChild(marker);
    console.log('CiteRight extension marker injected');

})();
