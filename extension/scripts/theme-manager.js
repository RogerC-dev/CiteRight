/**
 * Theme Manager for Precedent Extension
 * Handles dark/light mode toggle and persistence across ALL extension contexts
 * Syncs: Popup HTML, Sidebar Vue, Popover Vue, and any other pages
 */

const ThemeManager = {
  STORAGE_KEY: 'precedent-theme',
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
  },

  /**
   * Initialize theme manager
   * Call this on every page load
   */
  init: async function() {
    const savedTheme = await this.getSavedTheme();
    this.applyTheme(savedTheme);
    this.watchSystemPreference();
    this.setupToggleListeners();
    this.setupStorageListener();
    return savedTheme;
  },

  /**
   * Get saved theme from chrome.storage
   */
  getSavedTheme: function() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([this.STORAGE_KEY], (result) => {
          resolve(result[this.STORAGE_KEY] || this.THEMES.SYSTEM);
        });
      } else {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        resolve(saved || this.THEMES.SYSTEM);
      }
    });
  },

  /**
   * Save theme preference and broadcast to all contexts
   */
  saveTheme: function(theme) {
    // Save to chrome.storage (this triggers onChanged for all contexts)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [this.STORAGE_KEY]: theme });
      
      // Also send message to content scripts via runtime
      if (chrome.runtime && chrome.tabs) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, {
                action: 'THEME_CHANGED',
                theme: theme,
                effectiveTheme: theme === this.THEMES.SYSTEM ? this.getSystemPreference() : theme
              });
            } catch (e) {
              // Tab might not have content script
            }
          });
        });
      }
    }
    
    // Always save to localStorage as fallback
    localStorage.setItem(this.STORAGE_KEY, theme);
  },

  /**
   * Get system preference
   */
  getSystemPreference: function() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.THEMES.DARK;
    }
    return this.THEMES.LIGHT;
  },

  /**
   * Apply theme to document
   */
  applyTheme: function(theme) {
    const effectiveTheme = theme === this.THEMES.SYSTEM 
      ? this.getSystemPreference() 
      : theme;

    const html = document.documentElement;
    const body = document.body;

    if (effectiveTheme === this.THEMES.DARK) {
      html.setAttribute('data-bs-theme', 'dark');
      html.classList.add('dark');
      if (body) {
        body.setAttribute('data-bs-theme', 'dark');
        body.classList.add('dark');
      }
    } else {
      html.removeAttribute('data-bs-theme');
      html.classList.remove('dark');
      if (body) {
        body.removeAttribute('data-bs-theme');
        body.classList.remove('dark');
      }
    }

    // Update toggle button icons if present
    this.updateToggleIcons(effectiveTheme);

    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: effectiveTheme, setting: theme } 
    }));
    
    console.log('[ThemeManager] Applied theme:', effectiveTheme);
  },

  /**
   * Toggle between light and dark mode
   */
  toggle: async function() {
    const currentTheme = await this.getSavedTheme();
    let newTheme;

    if (currentTheme === this.THEMES.SYSTEM) {
      newTheme = this.getSystemPreference() === this.THEMES.DARK 
        ? this.THEMES.LIGHT 
        : this.THEMES.DARK;
    } else if (currentTheme === this.THEMES.DARK) {
      newTheme = this.THEMES.LIGHT;
    } else {
      newTheme = this.THEMES.DARK;
    }

    this.saveTheme(newTheme);
    this.applyTheme(newTheme);
    
    console.log('[ThemeManager] Toggled to:', newTheme);
    return newTheme;
  },

  /**
   * Set specific theme
   */
  setTheme: function(theme) {
    if (Object.values(this.THEMES).includes(theme)) {
      this.saveTheme(theme);
      this.applyTheme(theme);
    }
  },

  /**
   * Watch for system preference changes
   */
  watchSystemPreference: function() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
        const savedTheme = await this.getSavedTheme();
        if (savedTheme === this.THEMES.SYSTEM) {
          this.applyTheme(this.THEMES.SYSTEM);
        }
      });
    }
  },

  /**
   * Listen for storage changes from other contexts (popup, other tabs)
   */
  setupStorageListener: function() {
    // Listen for chrome.storage changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[this.STORAGE_KEY]) {
          const newTheme = changes[this.STORAGE_KEY].newValue;
          console.log('[ThemeManager] Storage changed, new theme:', newTheme);
          this.applyTheme(newTheme);
        }
      });
    }
    
    // Listen for runtime messages (from popup to content scripts)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'THEME_CHANGED') {
          console.log('[ThemeManager] Received theme change message:', message.theme);
          this.applyTheme(message.theme);
          sendResponse({ success: true });
        }
      });
    }
    
    // Also listen for localStorage changes (for non-extension contexts)
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY && e.newValue) {
        console.log('[ThemeManager] localStorage changed:', e.newValue);
        this.applyTheme(e.newValue);
      }
    });
  },

  /**
   * Setup click listeners for theme toggle buttons
   */
  setupToggleListeners: function() {
    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
    toggleButtons.forEach(button => {
      button.addEventListener('click', () => this.toggle());
    });
  },

  /**
   * Update toggle button icons based on current theme
   */
  updateToggleIcons: function(theme) {
    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
    toggleButtons.forEach(button => {
      const icon = button.querySelector('i');
      if (icon) {
        if (theme === this.THEMES.DARK) {
          icon.className = 'bi bi-sun-fill';
        } else {
          icon.className = 'bi bi-moon-fill';
        }
      }
    });
  },

  /**
   * Get current effective theme (resolved from system if needed)
   */
  getCurrentTheme: async function() {
    const saved = await this.getSavedTheme();
    return saved === this.THEMES.SYSTEM ? this.getSystemPreference() : saved;
  },

  /**
   * Check if current theme is dark
   */
  isDark: async function() {
    const theme = await this.getCurrentTheme();
    return theme === this.THEMES.DARK;
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
  ThemeManager.init();
}

// Make available globally
window.ThemeManager = ThemeManager;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
