// Extension state management - default to enabled
let isEnabled = true;

// Check if running in extension context
const isExtensionContext = !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);

console.log('🔧 Popup script loaded, extension context:', isExtensionContext);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎯 DOM loaded, initializing popup...');

    // DOM elements
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const bookmarksButton = document.getElementById('bookmarksButton');
    const settingsButton = document.getElementById('settingsButton');
    const homeButton = document.getElementById('homeButton');
    const aiChatButton = document.getElementById('aiChatButton');
    const practiceButton = document.getElementById('practiceButton');

    console.log('📋 DOM elements found:', {
        toggleSwitch: !!toggleSwitch,
        statusDot: !!statusDot,
        statusText: !!statusText,
        bookmarksButton: !!bookmarksButton,
        settingsButton: !!settingsButton
    });

    // Load saved state
    loadExtensionState();

    // Event listeners
    if (toggleSwitch) {
        toggleSwitch.addEventListener('click', toggleExtension);
        console.log('✅ Toggle switch event listener added');
    }

    if (bookmarksButton) {
        bookmarksButton.addEventListener('click', openBookmarks);
        console.log('✅ Bookmarks button event listener added');
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', openSettings);
        console.log('✅ Settings button event listener added');
    }

    if (homeButton) {
        homeButton.addEventListener('click', openHome);
        console.log('✅ Home button event listener added');
    }

    if (aiChatButton) {
        aiChatButton.addEventListener('click', openAIChat);
        console.log('✅ AI Chat button event listener added');
    }

    if (practiceButton) {
        practiceButton.addEventListener('click', openPractice);
        console.log('✅ Practice button event listener added');
    }

    // Add entrance animations
    const elements = document.querySelectorAll('.toggle-section, .action-button');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });

    console.log('🚀 Popup initialization complete');
});

function toggleExtension() {
    console.log('🔄 Toggle clicked, current state:', isEnabled);
    isEnabled = !isEnabled;
    console.log('🔄 New state:', isEnabled ? 'ENABLED' : 'DISABLED');
    updateUI();
    saveExtensionState();

    // Send global enable state change to background script
    if (isExtensionContext) {
        try {
            console.log('📤 Sending global toggle to background script...');
            chrome.runtime.sendMessage({
                action: 'GLOBAL_TOGGLE_ENABLE_STATE',
                enabled: isEnabled
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Background script error:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Global toggle response:', response);
                }
            });
        } catch (e) {
            console.error('❌ Error sending to background:', e);
        }
    } else {
        console.log('Not in extension context - background message skipped');
    }

    // Send message to current tab's content script
    if (isExtensionContext) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs && tabs[0]) {
                    console.log('📤 Sending toggle message to content script on tab:', tabs[0].id);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleExtension',
                        enabled: isEnabled
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Content script error:', chrome.runtime.lastError);
                        } else {
                            console.log('✅ Content script response:', response);
                        }
                    });
                } else {
                    console.log('❌ No active tab found for toggle');
                }
            });
        } catch (e) {
            console.error('❌ Error sending to content script:', e);
        }
    } else {
        // For testing without extension context
        alert(`法律辨識工具已${isEnabled ? '啟用' : '停用'}\n\n在實際使用時，請在擴充功能中操作。`);
    }

    // Visual feedback
    const toggleSwitch = document.getElementById('toggleSwitch');
    toggleSwitch.style.transform = 'scale(0.95)';
    setTimeout(() => {
        toggleSwitch.style.transform = 'scale(1)';
    }, 150);
}

function openSettings() {
    console.log('⚙️ Settings button clicked');
    if (isExtensionContext) {
        try {
            const settingsUrl = chrome.runtime.getURL('extension/pages/index.html');
            console.log('📤 Opening settings URL:', settingsUrl);

            // Open index.html in new tab (extension context)
            chrome.tabs.create({
                url: settingsUrl
            }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Error creating settings tab:', chrome.runtime.lastError);
                    alert('無法開啟設定頁面。請確認擴充功能正常運行。');
                } else {
                    console.log('✅ Settings tab created:', tab.id);
                }
            });

            // Close popup after action
            if (typeof window.close === 'function') {
                setTimeout(() => window.close(), 200);
            }
        } catch (e) {
            console.error('❌ Error in openSettings:', e);
            alert('無法開啟設定頁面。請確認 index.html 檔案存在。');
        }
    } else {
        // For testing - open in new window
        console.log('Opening settings via window.open (test mode)');
        window.open('index.html', '_blank');
    }
}

function openHome() {
    console.log('🏠 Home button clicked');
    openExtensionPage('extension/pages/index.html#/');
}

function openAIChat() {
    console.log('🤖 AI Chat button clicked');
    openExtensionPage('extension/pages/ai-legal-interface.html');
}

function openPractice() {
    console.log('📚 Practice button clicked - opening exam-bank.html');
    openExtensionPage('extension/pages/exam-bank.html');
}

function openBookmarks() {
    console.log('📚 Bookmarks button clicked');
    if (isExtensionContext) {
        try {
            // Send message to content script to open bookmarks
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs && tabs[0]) {
                    console.log('📤 Sending openBookmarks message to tab:', tabs[0].id);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'openBookmarks'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Error sending bookmarks message:', chrome.runtime.lastError);
                            alert('無法開啟書籤面板。請重新載入頁面後再試。');
                        } else {
                            console.log('✅ Bookmarks response:', response);
                        }
                    });
                } else {
                    console.log('❌ No active tab found for bookmarks');
                    alert('無法找到活躍的分頁。請確認您在正確的頁面上。');
                }
            });

            // Close popup after action
            if (typeof window.close === 'function') {
                setTimeout(() => window.close(), 300); // Increased delay
            }
        } catch (e) {
            console.error('❌ Error in openBookmarks:', e);
            alert('無法開啟書籤面板。請確認擴充功能正常運行。');
        }
    } else {
        // For testing without extension context
        console.log('Chrome tabs not available - showing test message');
        alert('書籤功能需要在實際擴充功能中使用。\n\n請確認擴充功能已正確安裝。');
    }
}

function openExtensionPage(path) {
    if (isExtensionContext) {
        try {
            const pageUrl = chrome.runtime.getURL(path);
            console.log('📤 Opening extension page:', pageUrl);

            chrome.tabs.create({
                url: pageUrl
            }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Error creating tab:', chrome.runtime.lastError);
                    alert('無法開啟頁面。請確認擴充功能正常運行。');
                } else {
                    console.log('✅ Tab created:', tab.id);
                }
            });

            // Close popup after action
            if (typeof window.close === 'function') {
                setTimeout(() => window.close(), 200);
            }
        } catch (e) {
            console.error('❌ Error in openExtensionPage:', e);
            alert('無法開啟頁面。請確認擴充功能正常運行。');
        }
    } else {
        // For testing - open in new window
        console.log('Opening page via window.open (test mode)');
        window.open(path, '_blank');
    }
}

function updateUI() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (isEnabled) {
        toggleSwitch.classList.add('active');
        statusDot.classList.add('active');
        statusText.textContent = '法律辨識工具已啟用';
    } else {
        toggleSwitch.classList.remove('active');
        statusDot.classList.remove('active');
        statusText.textContent = '法律辨識工具已停用';
    }
}

function saveExtensionState() {
    // Save to localStorage
    localStorage.setItem('citeright-enabled', isEnabled);

    // For Chrome extension, also use chrome.storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ 'citeright_enabled': isEnabled });
    }
}

function loadExtensionState() {
    console.log('Loading extension state, isExtensionContext:', isExtensionContext);

    // For Chrome extension, use chrome.storage
    if (isExtensionContext && chrome.storage) {
        chrome.storage.local.get(['citeright_enabled'], function (result) {
            console.log('Chrome storage result:', result);
            // Default to enabled if not set
            if (result.citeright_enabled !== undefined) {
                isEnabled = result.citeright_enabled;
            } else {
                // First time - default to enabled and save it
                isEnabled = true;
                saveExtensionState();
            }
            console.log('Extension state loaded:', isEnabled);
            updateUI();
        });
    } else {
        // Fallback to localStorage (for testing)
        console.log('Using localStorage fallback');
        const saved = localStorage.getItem('citeright-enabled');
        if (saved !== null) {
            isEnabled = saved === 'true';
        } else {
            // Default to enabled
            isEnabled = true;
            saveExtensionState();
        }
        console.log('Extension state loaded from localStorage:', isEnabled);
        updateUI();
    }
}