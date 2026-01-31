/**
 * Auth Bridge - Connects Precedent Extension to ExamQuestionBank Authentication
 * 
 * This module handles:
 * 1. Local user ID generation and storage
 * 2. Opening ExamQuestionBank login page
 * 3. Listening for authentication success via BroadcastChannel
 * 4. Storing Supabase user credentials for API calls
 */

const AUTH_CONFIG = {
    // ExamQuestionBank URL - the app is served at root
    examBankBaseUrl: 'http://localhost:5173',

    // Storage keys
    LOCAL_USER_ID_KEY: 'precedent_local_user_id',
    SUPABASE_USER_KEY: 'precedent_supabase_user',
    AUTH_STATE_KEY: 'precedent_auth_state',

    // BroadcastChannel name (must match ExamQuestionBank)
    BROADCAST_CHANNEL: 'precedent_auth'
};

/**
 * Generate a UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create a local user ID for anonymous users
 * This ID is used to track sessions before user logs in
 */
async function getOrCreateLocalUserId() {
    return new Promise((resolve) => {
        chrome.storage.local.get([AUTH_CONFIG.LOCAL_USER_ID_KEY], (result) => {
            if (result[AUTH_CONFIG.LOCAL_USER_ID_KEY]) {
                resolve(result[AUTH_CONFIG.LOCAL_USER_ID_KEY]);
            } else {
                const newId = generateUUID();
                chrome.storage.local.set({ [AUTH_CONFIG.LOCAL_USER_ID_KEY]: newId }, () => {
                    console.log('🔑 Generated new local user ID:', newId);
                    resolve(newId);
                });
            }
        });
    });
}

/**
 * Get the current authentication state
 * Returns: { isAuthenticated, localUserId, supabaseUser }
 */
async function getAuthState() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            AUTH_CONFIG.LOCAL_USER_ID_KEY,
            AUTH_CONFIG.SUPABASE_USER_KEY,
            AUTH_CONFIG.AUTH_STATE_KEY
        ], (result) => {
            const authState = {
                isAuthenticated: false,
                localUserId: result[AUTH_CONFIG.LOCAL_USER_ID_KEY] || null,
                supabaseUser: null,
                tier: 'anonymous'
            };

            if (result[AUTH_CONFIG.SUPABASE_USER_KEY]) {
                authState.isAuthenticated = true;
                authState.supabaseUser = result[AUTH_CONFIG.SUPABASE_USER_KEY];
                authState.tier = authState.supabaseUser.tier || 'free';
            }

            resolve(authState);
        });
    });
}

/**
 * Store Supabase user credentials after successful OAuth
 */
async function storeSupabaseUser(userData) {
    return new Promise((resolve) => {
        const userObj = {
            userId: userData.userId,
            email: userData.email,
            displayName: userData.displayName,
            tier: userData.tier || 'free',
            authenticatedAt: Date.now()
        };

        chrome.storage.local.set({
            [AUTH_CONFIG.SUPABASE_USER_KEY]: userObj,
            [AUTH_CONFIG.AUTH_STATE_KEY]: 'authenticated'
        }, () => {
            console.log('✅ Supabase user stored:', userObj.email);
            resolve(userObj);
        });
    });
}

/**
 * Clear authentication state (logout)
 */
async function clearAuthState() {
    return new Promise((resolve) => {
        chrome.storage.local.remove([
            AUTH_CONFIG.SUPABASE_USER_KEY,
            AUTH_CONFIG.AUTH_STATE_KEY
        ], () => {
            console.log('🚪 User logged out');
            resolve();
        });
    });
}

/**
 * Open ExamQuestionBank login page in a new tab
 */
async function openLoginPage() {
    const localUserId = await getOrCreateLocalUserId();

    // Build login URL with extension source parameter
    const loginUrl = new URL(AUTH_CONFIG.examBankBaseUrl);
    loginUrl.searchParams.set('source', 'precedent_extension');
    loginUrl.searchParams.set('local_user_id', localUserId);

    console.log('🔗 Opening login page:', loginUrl.toString());

    // Open in new tab
    chrome.tabs.create({ url: loginUrl.toString() });

    // Start listening for auth callback
    listenForAuthCallback();
}

/**
 * Listen for authentication success via BroadcastChannel
 * This works when the login page broadcasts after successful OAuth
 */
function listenForAuthCallback() {
    // BroadcastChannel approach - works for same-origin pages
    // Note: This may not work directly in extension context
    // We'll also check localStorage via content scripts

    console.log('👂 Listening for auth callback...');

    // Set up a polling mechanism to check for auth success in storage
    // The ExamQuestionBank page will store auth data that we can read
    const checkInterval = setInterval(async () => {
        try {
            // Check if auth was stored by the web page
            const result = await chrome.storage.local.get(['pending_auth_check']);

            // We need to use a content script to read localStorage from ExamQuestionBank
            // For now, we'll rely on the user returning to the extension after login

        } catch (err) {
            console.warn('Auth check error:', err);
        }
    }, 2000);

    // Stop checking after 5 minutes
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏱️ Auth callback listener timed out');
    }, 5 * 60 * 1000);
}

/**
 * Process auth success message from ExamQuestionBank
 * Called when we detect successful authentication
 */
async function processAuthSuccess(authData) {
    console.log('🎉 Processing auth success:', authData);

    // Store the Supabase user
    await storeSupabaseUser(authData);

    // Link local sessions to the new Supabase user
    const localUserId = await getOrCreateLocalUserId();

    try {
        // Call the Precedent server to link sessions
        const response = await fetch('http://localhost:3000/api/ai-chat/link-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-local-user-id': localUserId
            },
            body: JSON.stringify({
                supabaseUserId: authData.userId
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Linked ${result.data.sessionsLinked} sessions to Supabase user`);
        }
    } catch (err) {
        console.warn('Could not link sessions:', err);
    }

    // Broadcast state change to all extension contexts
    chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        isAuthenticated: true,
        user: authData
    });
}

/**
 * Get headers for API requests including auth info
 */
async function getAuthHeaders() {
    const authState = await getAuthState();
    const headers = {
        'x-local-user-id': authState.localUserId || 'anonymous',
        'x-user-tier': authState.tier
    };

    if (authState.supabaseUser) {
        headers['x-supabase-user-id'] = authState.supabaseUser.userId;
    }

    return headers;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.AuthBridge = {
        getOrCreateLocalUserId,
        getAuthState,
        storeSupabaseUser,
        clearAuthState,
        openLoginPage,
        processAuthSuccess,
        getAuthHeaders,
        AUTH_CONFIG
    };
}

// Also expose to extension context
if (typeof globalThis !== 'undefined') {
    globalThis.AuthBridge = window.AuthBridge;
}

console.log('🔐 Auth Bridge loaded');
