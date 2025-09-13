// Add this to your existing createMainSidebar() function
// Replace the tab navigation section with this enhanced version:

function createMainSidebar() {
    // Remove any existing sidebar
    const existingSidebar = document.getElementById('citeright-sidebar-background');
    if (existingSidebar) {
        existingSidebar.remove();
    }
    
    const existingToolPanel = document.getElementById('citeright-tool-panel');
    if (existingToolPanel) {
        existingToolPanel.remove();
    }

    // Create sidebar background (same as before)
    const sidebarBackground = document.createElement('div');
    sidebarBackground.id = 'citeright-sidebar-background';
    sidebarBackground.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 33vw;
        height: 100vh;
        background: rgba(24, 144, 255, 0.03);
        z-index: 2147483645;
        border-left: 1px solid rgba(24, 144, 255, 0.1);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(sidebarBackground);
    
    // Create enhanced tool panel with dictionary tab
    const savedPanelWidth = localStorage.getItem('citeright-panel-width');
    const sidebarWidth = Math.floor(window.innerWidth / 3);
    const defaultPanelWidth = sidebarWidth - 10;
    const panelWidth = savedPanelWidth ? parseInt(savedPanelWidth) : defaultPanelWidth;
    
    const toolPanel = document.createElement('div');
    toolPanel.id = 'citeright-tool-panel';
    toolPanel.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: ${panelWidth}px;
        height: 100vh;
        background: white;
        border-left: 3px solid #1890ff;
        z-index: 2147483647;
        font-family: "Microsoft JhengHei", Arial, sans-serif;
        font-size: 14px;
        box-shadow: -6px 0 18px rgba(0,0,0,0.15);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    // Enhanced HTML with dictionary tab
    toolPanel.innerHTML = `
        <div id="resize-handle" style="position: absolute; left: -6px; top: 0; bottom: 0; width: 12px; background: linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff); cursor: ew-resize; z-index: 10; opacity: 0.8; transition: all 0.2s; border-radius: 4px 0 0 4px; box-shadow: -2px 0 8px rgba(24,144,255,0.3);"></div>
        
        <!-- Tab Navigation with Dictionary -->
        <div style="background: linear-gradient(135deg, #1890ff, #096dd9); color: white; padding: 16px; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">CiteRight 工具面板</h2>
                <button id="close-tool-panel" style="display:flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 8px; cursor: pointer; font-size: 18px; width: 36px; height: 36px;">&times;</button>
            </div>
            
            <div class="tab-navigation" style="display: flex; gap: 8px;">
                <button id="tab-tool" class="tab-btn active" data-tab="tool">
                    🔧 法律工具
                </button>
                <button id="tab-bookmarks" class="tab-btn" data-tab="bookmarks">
                    📚 我的書籤
                </button>
                <button id="tab-dictionary" class="tab-btn" data-tab="dictionary">
                    📖 法律辭典
                </button>
            </div>
        </div>
        
        <!-- Tab Content Areas -->
        <div id="tab-content-tool" class="tab-content active">
            <div class="tab-content-inner">
                <div id="tool-content">
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔧</div>
                        <div>請點擊法律條文來查看詳細資訊</div>
                        <div style="font-size: 12px; margin-top: 8px;">按 Ctrl 啟動懸停模式</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="tab-content-bookmarks" class="tab-content">
            <div class="tab-content-inner">
                <div id="bookmarks-content">
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                        <div>正在載入書籤...</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="tab-content-dictionary" class="tab-content">
            <div class="tab-content-inner">
                <div id="dictionary-content">
                    ${getDictionaryHTML()}
                </div>
            </div>
        </div>
        
        <!-- Enhanced styles including dictionary styles -->
        <style>
        ${getDictionaryStyles()}
        </style>
    `;

    document.body.appendChild(toolPanel);
    adjustWebContentForSidebar(Math.floor(window.innerWidth / 3));

    setTimeout(() => {
        toolPanel.style.transform = 'translateX(0)';
    }, 10);

    setupToolPanelEventListeners(toolPanel);
    loadBookmarksContent();
    
    return toolPanel;
}

// Dictionary HTML template
function getDictionaryHTML() {
    return `
        <!-- Search Section -->
        <div class="dictionary-search-container">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #096dd9;">
                🔍 法規智慧搜尋
            </h3>
            <div class="dictionary-search-box">
                <input type="text" 
                       class="dictionary-search-input" 
                       id="dictionary-search" 
                       placeholder="輸入法規名稱或條文關鍵字...">
                <button class="dictionary-search-btn" id="dictionary-search-btn">搜尋</button>
            </div>
            <div class="search-hint">
                💡 <strong>搜尋提示：</strong>您可以搜尋完整法規名稱如「民法」，或使用關鍵字組合如「勞動基準法 加班」、「刑法 詐欺」來精準定位相關條文。
            </div>
        </div>
        
        <!-- Quick Access Panel -->
        <div class="quick-access-panel">
            <div class="quick-access-title">⚡ 快速查詢</div>
            <div class="recent-searches">
                <span class="recent-search-tag">民法總則</span>
                <span class="recent-search-tag">刑法總則</span>
                <span class="recent-search-tag">勞動基準法</span>
                <span class="recent-search-tag">公司法</span>
            </div>
        </div>
        
        <!-- Law Categories -->
        <div class="law-categories">
            ${getLawCategoriesHTML()}
        </div>
    `;
}

// Dictionary styles
function getDictionaryStyles() {
    return `
        .tab-btn {
            padding: 8px 16px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            font-family: inherit;
        }
        .tab-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        .tab-btn.active {
            background: rgba(255,255,255,0.4);
            font-weight: 600;
        }
        .tab-content {
            display: none;
            flex: 1;
            overflow: hidden;
            background: #fafafa;
        }
        .tab-content.active {
            display: flex;
            flex-direction: column;
        }
        .tab-content-inner {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: white;
            margin: 8px;
            border-radius: 8px;
            border: 1px solid #e8e8e8;
        }
        
        /* Dictionary specific styles */
        .dictionary-search-container {
            background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            border: 1px solid #91d5ff;
        }
        .dictionary-search-box {
            position: relative;
            margin-bottom: 12px;
        }
        .dictionary-search-input {
            width: 100%;
            padding: 12px 48px 12px 16px;
            border: 2px solid #1890ff;
            border-radius: 8px;
            font-size: 14px;
            font-family: "Microsoft JhengHei";
            transition: all 0.3s;
            box-sizing: border-box;
        }
        .dictionary-search-input:focus {
            outline: none;
            border-color: #096dd9;
            box-shadow: 0 0 0 3px rgba(24,144,255,0.1);
        }
        .dictionary-search-btn {
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
            background: #1890ff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .dictionary-search-btn:hover {
            background: #096dd9;
        }
        .search-hint {
            font-size: 12px;
            color: #666;
            line-height: 1.6;
            background: rgba(255,255,255,0.8);
            padding: 8px 12px;
            border-radius: 6px;
            margin-top: 8px;
        }
        .quick-access-panel {
            background: linear-gradient(135deg, #fff7e6, #fffbe6);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            border: 1px solid #ffd591;
        }
        .quick-access-title {
            font-size: 13px;
            font-weight: 600;
            color: #fa8c16;
            margin-bottom: 8px;
        }
        .recent-searches {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .recent-search-tag {
            padding: 4px 8px;
            background: white;
            border: 1px solid #ffd591;
            border-radius: 12px;
            font-size: 12px;
            color: #fa8c16;
            cursor: pointer;
            transition: all 0.2s;
        }
        .recent-search-tag:hover {
            background: #fff7e6;
        }
        .law-categories {
            display: grid;
            gap: 12px;
        }
        .category-section {
            background: #fafafa;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e8e8e8;
            transition: all 0.2s;
        }
        .category-section:hover {
            border-color: #1890ff;
            background: #f0f9ff;
        }
        .category-title {
            font-size: 15px;
            font-weight: 600;
            color: #1890ff;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .law-links {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .law-link {
            padding: 6px 12px;
            background: white;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            color: #333;
            text-decoration: none;
            font-size: 13px;
            transition: all 0.2s;
            cursor: pointer;
        }
        .law-link:hover {
            border-color: #1890ff;
            color: #1890ff;
            background: #f0f9ff;
            transform: translateY(-1px);
        }
    `;
}

// Law categories HTML
function getLawCategoriesHTML() {
    const categories = [
        {
            title: '⚖️ 民事法規',
            laws: ['民法', '民事訴訟法', '家事事件法', '消費者保護法', '公寓大廈管理條例']
        },
        {
            title: '🚨 刑事法規',
            laws: ['刑法', '刑事訴訟法', '少年事件處理法', '毒品危害防制條例']
        },
        {
            title: '📋 行政法規',
            laws: ['行政程序法', '行政訴訟法', '訴願法', '國家賠償法']
        },
        {
            title: '💼 商事法規',
            laws: ['公司法', '票據法', '證券交易法', '保險法', '海商法']
        },
        {
            title: '👷 勞動法規',
            laws: ['勞動基準法', '勞工保險條例', '勞工退休金條例', '職業安全衛生法']
        }
    ];
    
    return categories.map(cat => `
        <div class="category-section">
            <div class="category-title">${cat.title}</div>
            <div class="law-links">
                ${cat.laws.map(law => `<a class="law-link" data-law="${law}">${law}</a>`).join('')}
            </div>
        </div>
    `).join('');
}

// Enhanced event listeners setup with dictionary functionality
function setupToolPanelEventListeners(toolPanel) {
    // Tab switching
    const tabButtons = toolPanel.querySelectorAll('.tab-btn');
    const tabContents = toolPanel.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update button states
            tabButtons.forEach(b => {
                if (b.dataset.tab === targetTab) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            // Update content visibility
            tabContents.forEach(content => {
                if (content.id === `tab-content-${targetTab}`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
            
            // Initialize content based on tab
            if (targetTab === 'bookmarks') {
                loadBookmarksContent();
            } else if (targetTab === 'dictionary') {
                initializeDictionary();
            }
        });
    });

    // Close button
    toolPanel.querySelector('#close-tool-panel').addEventListener('click', () => {
        closeToolPanel();
    });

    // Resize functionality
    setupToolPanelResize(toolPanel);
    
    // Dictionary specific event listeners
    setupDictionaryEventListeners(toolPanel);
}

// Dictionary event listeners
function setupDictionaryEventListeners(toolPanel) {
    // Search functionality
    const searchInput = toolPanel.querySelector('#dictionary-search');
    const searchBtn = toolPanel.querySelector('#dictionary-search-btn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', () => performDictionarySearch(searchInput.value));
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performDictionarySearch(searchInput.value);
            }
        });
        
        // Auto-suggest (debounced)
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length > 1) {
                    showSearchSuggestions(e.target.value);
                }
            }, 300);
        });
    }
    
    // Quick search tags
    toolPanel.querySelectorAll('.recent-search-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = tag.textContent;
                performDictionarySearch(tag.textContent);
            }
        });
    });
    
    // Law links
    toolPanel.querySelectorAll('.law-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const lawName = e.target.dataset.law;
            loadLawContent(lawName);
        });
    });
}

// Dictionary search function
function performDictionarySearch(searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
        showNotification('請輸入搜尋關鍵字', 'warning');
        return;
    }
    
    console.log('🔍 Searching for:', searchTerm);
    
    // Save to recent searches
    saveRecentSearch(searchTerm);
    
    // Show loading state
    const btn = document.querySelector('#dictionary-search-btn');
    if (btn) {
        btn.textContent = '搜尋中...';
        btn.disabled = true;
    }
    
    // Send search request to background script
    chrome.runtime.sendMessage({
        action: 'searchLawDictionary',
        query: searchTerm
    }, (response) => {
        // Reset button
        if (btn) {
            btn.textContent = '搜尋';
            btn.disabled = false;
        }
        
        if (response && response.success) {
            displayDictionaryResults(response.results);
        } else {
            showNotification('搜尋失敗，請稍後再試', 'error');
        }
    });
}

// Load specific law content
function loadLawContent(lawName) {
    console.log('📖 Loading law:', lawName);
    
    // Update search input
    const searchInput = document.querySelector('#dictionary-search');
    if (searchInput) {
        searchInput.value = lawName;
    }
    
    // Switch to tool tab to display content
    const toolTabBtn = document.querySelector('#tab-tool');
    const toolContent = document.querySelector('#tab-content-tool');
    
    if (toolTabBtn && toolContent) {
        toolTabBtn.click();
    }
    
    // Fetch and display law content
    chrome.runtime.sendMessage({
        action: 'fetchLawContent',
        lawName: lawName
    }, (response) => {
        if (response && response.success) {
            displayLawInToolTab(response.data);
        } else {
            showNotification('無法載入法規內容', 'error');
        }
    });
}

// Display search results in dictionary
function displayDictionaryResults(results) {
    const dictionaryContent = document.querySelector('#dictionary-content');
    if (!dictionaryContent) return;
    
    const resultsHTML = `
        <div class="search-results" style="margin-bottom: 16px;">
            <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; border: 1px solid #91d5ff; margin-bottom: 12px;">
                <h3 style="color: #1890ff; margin: 0 0 8px 0;">搜尋結果 (${results.length} 筆)</h3>
                <button id="clear-results" style="padding: 4px 8px; background: white; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 12px; cursor: pointer;">清除結果</button>
            </div>
            ${results.map(result => `
                <div class="result-item" data-law="${result.lawName}" data-article="${result.article}" style="background: white; padding: 12px; margin-bottom: 8px; border: 1px solid #e8e8e8; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                    <div style="font-weight: 600; color: #1890ff; margin-bottom: 4px;">${result.title}</div>
                    <div style="font-size: 13px; color: #666; line-height: 1.5;">${result.preview}</div>
                    <div style="font-size: 11px; color: #999; margin-top: 4px;">來源：${result.source}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Replace existing results or insert after search container
    const existingResults = dictionaryContent.querySelector('.search-results');
    if (existingResults) {
        existingResults.outerHTML = resultsHTML;
    } else {
        const searchContainer = dictionaryContent.querySelector('.dictionary-search-container');
        searchContainer.insertAdjacentHTML('afterend', resultsHTML);
    }
    
    // Add click handlers to results
    dictionaryContent.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
            const lawName = item.dataset.law;
            const article = item.dataset.article;
            loadLawArticle(lawName, article);
        });
    });
    
    // Clear results button
    const clearBtn = dictionaryContent.querySelector('#clear-results');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const results = dictionaryContent.querySelector('.search-results');
            if (results) results.remove();
        });
    }
}

// Helper functions
function initializeDictionary() {
    console.log('📖 Dictionary initialized');
    loadRecentSearches();
}

function saveRecentSearch(term) {
    let searches = JSON.parse(localStorage.getItem('citeright_recent_searches') || '[]');
    searches = [term, ...searches.filter(s => s !== term)].slice(0, 10);
    localStorage.setItem('citeright_recent_searches', JSON.stringify(searches));
}

function loadRecentSearches() {
    const searches = JSON.parse(localStorage.getItem('citeright_recent_searches') || '[]');
    const container = document.querySelector('.recent-searches');
    
    if (container && searches.length > 0) {
        container.innerHTML = searches.slice(0, 4).map(term => 
            `<span class="recent-search-tag">${term}</span>`
        ).join('');
        
        // Re-attach event listeners
        container.querySelectorAll('.recent-search-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const searchInput = document.querySelector('#dictionary-search');
                if (searchInput) {
                    searchInput.value = tag.textContent;
                    performDictionarySearch(tag.textContent);
                }
            });
        });
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        info: '#1890ff',
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483649;
        background: ${colors[type]};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}