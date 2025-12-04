(function () {
    const isExtensionContext = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.getURL);
    const DEFAULT_COMPONENT_PATH = '../components/navigation.html';

    async function loadExtensionNavigation(containerOrId = 'navigation-container', options = {}) {
        const container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;

        if (!container || container.dataset.navLoaded === 'true') {
            return;
        }

        const fallbackPath = container.dataset.navPath || DEFAULT_COMPONENT_PATH;
        const navUrl = isExtensionContext
            ? chrome.runtime.getURL('extension/components/navigation.html')
            : fallbackPath;

        try {
            const response = await fetch(navUrl);
            if (!response.ok) {
                throw new Error(`Navigation component request failed: ${response.status}`);
            }

            const html = await response.text();
            container.innerHTML = html;
            container.dataset.navLoaded = 'true';

            if (options.activeKey) {
                const root = container.querySelector('#extensionNav');
                if (root) {
                    root.dataset.forceActive = options.activeKey;
                }
            }

            // Re-run any script tags within the injected markup
            const scripts = Array.from(container.querySelectorAll('script'));
            scripts.forEach((oldScript) => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        } catch (error) {
            console.error('Failed to load extension navigation:', error);
        }
    }

    window.loadExtensionNavigation = loadExtensionNavigation;
})();
