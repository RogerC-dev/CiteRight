/**
 * Simple Hash-Based Router for Chrome Extension Pages
 * Supports navigation between extension pages using hash routes
 */

class ExtensionRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeRouteChange = null;
    this.afterRouteChange = null;
    
    // Bind methods
    this.handleHashChange = this.handleHashChange.bind(this);
    this.navigate = this.navigate.bind(this);
    
    // Initialize
    this.init();
  }

  init() {
    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange);
    
    // Handle initial route
    this.handleHashChange();
  }

  /**
   * Register a route
   * @param {string} path - Route path (e.g., '/practice', '/flashcards')
   * @param {Function} handler - Route handler function
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   * @param {boolean} replace - Replace current history entry
   */
  navigate(path, replace = false) {
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    const hash = `#/${path}`;
    
    if (replace) {
      window.location.replace(window.location.pathname + hash);
    } else {
      window.location.hash = hash;
    }
  }

  /**
   * Get current route
   * @returns {string} Current route path
   */
  getCurrentRoute() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
      return hash.substring(2);
    }
    return '';
  }

  /**
   * Handle hash change event
   */
  handleHashChange() {
    const route = this.getCurrentRoute();
    
    // Call before route change hook
    if (this.beforeRouteChange) {
      const result = this.beforeRouteChange(route, this.currentRoute);
      if (result === false) {
        return; // Prevent route change
      }
    }

    // Find matching route
    let matched = false;
    for (const [path, handler] of this.routes.entries()) {
      if (this.matchRoute(route, path)) {
        matched = true;
        this.currentRoute = route;
        
        // Extract params if any
        const params = this.extractParams(route, path);
        
        // Call route handler
        try {
          handler(params, route);
        } catch (error) {
          console.error('Route handler error:', error);
        }
        
        break;
      }
    }

    // Default route if no match
    if (!matched && route === '') {
      // Default to home or first route
      const defaultHandler = this.routes.get('/') || this.routes.get('home');
      if (defaultHandler) {
        this.currentRoute = 'home';
        defaultHandler({}, 'home');
      }
    }

    // Call after route change hook
    if (this.afterRouteChange) {
      this.afterRouteChange(route, this.currentRoute);
    }
  }

  /**
   * Match route pattern with actual route
   * @param {string} route - Actual route
   * @param {string} pattern - Route pattern
   * @returns {boolean} True if matches
   */
  matchRoute(route, pattern) {
    // Exact match
    if (route === pattern) {
      return true;
    }

    // Pattern with params (e.g., /quiz/:id)
    const patternParts = pattern.split('/');
    const routeParts = route.split('/');

    if (patternParts.length !== routeParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        continue; // Param placeholder
      }
      if (patternParts[i] !== routeParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract parameters from route
   * @param {string} route - Actual route
   * @param {string} pattern - Route pattern
   * @returns {Object} Extracted parameters
   */
  extractParams(route, pattern) {
    const params = {};
    const patternParts = pattern.split('/');
    const routeParts = route.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].substring(1);
        params[paramName] = routeParts[i];
      }
    }

    return params;
  }

  /**
   * Set before route change hook
   * @param {Function} callback - Callback function
   */
  onBeforeRouteChange(callback) {
    this.beforeRouteChange = callback;
  }

  /**
   * Set after route change hook
   * @param {Function} callback - Callback function
   */
  onAfterRouteChange(callback) {
    this.afterRouteChange = callback;
  }

  /**
   * Destroy router
   */
  destroy() {
    window.removeEventListener('hashchange', this.handleHashChange);
    this.routes.clear();
  }
}

// Create global router instance
window.extensionRouter = new ExtensionRouter();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionRouter;
}

