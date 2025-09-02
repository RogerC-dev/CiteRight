// content.js - 台灣法源探測器 (CiteRight) 
// 整合台灣法律資料庫，支援法條、釋字、判決自動識別

const TAIWAN_LEGAL_PATTERNS = {
    // 法院判決: 110年度上字第1234號
    court_case: /([0-9０-９]{2,3})\s*年度?\s*([\u4e00-\u9fa5]{1,6}?)\s*字\s*第\s*([0-9０-９]+)\s*號/g,
    // 憲法法庭: 111年憲判字第13號  
    constitutional: /([0-9０-９]{2,3})\s*年\s*憲判字\s*第\s*([0-9０-９]+)\s*號/g,
    // 司法院大法官解釋: 釋字第748號
    interpretation: /釋字第\s*([0-9０-９]+)\s*號/g,
    // 法條引用: 民法第184條、刑法第271條第1項
    law_article: /([\u4e00-\u9fa5]{2,8}法)第\s*([0-9０-９]+(?:\s*條之\s*[0-9０-９]+)?)\s*條(?:第\s*([0-9０-９]+)\s*項)?/g
};

function toHalfWidthDigits(str) {
    return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30));
}

function makeSpan(match, key, groups) {
    let year = '', caseType = '', number = '', lawName = '', article = '', paragraph = '';
    
    if (key === 'court_case') {
        year = toHalfWidthDigits(groups[0]);
        caseType = groups[1];
        number = toHalfWidthDigits(groups[2]);
    } else if (key === 'constitutional') {
        year = toHalfWidthDigits(groups[0]);
        caseType = '憲判';
        number = toHalfWidthDigits(groups[1]);
    } else if (key === 'interpretation') {
        caseType = '釋字';
        number = toHalfWidthDigits(groups[0]);
    } else if (key === 'law_article') {
        lawName = groups[0]; // 民法、刑法等
        article = toHalfWidthDigits(groups[1]); // 184、271條之1
        paragraph = groups[2] ? toHalfWidthDigits(groups[2]) : ''; // 第1項
        caseType = '法條';
    }
    
    return `<span class="citeright-link" 
                data-year="${year}" 
                data-case-type="${caseType}" 
                data-number="${number}"
                data-law-name="${lawName}"
                data-article="${article}"
                data-paragraph="${paragraph}"
                data-legal-type="${key}"
                title="按住 Ctrl 並移動滑鼠查看詳情">${match}</span>`;
}

function highlightCitations() {
    console.log('🔍 Starting highlightCitations (TreeWalker)...');
    const seenNodes = new WeakSet();
    let created = 0;

    function processTextNode(node) {
        if (seenNodes.has(node)) return;
        if (!node.parentNode) return;
        // Skip inside our own spans or script/style/inputs
        const parentTag = node.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'INPUT') return;
        if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return;
        const original = node.textContent;
        if (!original || !original.trim()) return;

        let newHTML = original;
        let changed = false;
        for (const [key, pattern] of Object.entries(TAIWAN_LEGAL_PATTERNS)) {
            // fresh pattern each pass
            const fresh = new RegExp(pattern.source, pattern.flags);
            newHTML = newHTML.replace(fresh, (m, ...groups) => {
                changed = true;
                return makeSpan(m, key, groups);
            });
        }
        if (changed) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = newHTML;
            while (wrapper.firstChild) {
                node.parentNode.insertBefore(wrapper.firstChild, node);
            }
            node.parentNode.removeChild(node);
            created++;
        }
        seenNodes.add(node);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent || !/[字號釋憲判第度年]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const batch = [];
    while (walker.nextNode()) {
        batch.push(walker.currentNode);
        if (batch.length >= 500) {
            batch.forEach(processTextNode);
            batch.length = 0;
        }
    }
    if (batch.length) batch.forEach(processTextNode);

    const finalCount = document.querySelectorAll('.citeright-link').length;
    if (finalCount === 0) {
        console.warn('❌ 未檢測到法律引用標示。請檢查擴充套件是否已重新載入 / 或目前頁面無法律引用');
    } else {
        console.log(`✅ 法律引用偵測完成。找到 ${finalCount} 個法律引用標示 (本次新增: ${created})`);
    }
    return finalCount;
}

// Expose for manual debug
if (typeof window !== 'undefined') {
    window.citerightForceHighlight = highlightCitations;
}

function createPopoverElement() {
    // Remove any existing popover
    const existing = document.getElementById('citeright-popover');
    if (existing) existing.remove();
    const popover = document.createElement('div');
    popover.id = 'citeright-popover';
    popover.style.cssText = `position:fixed;z-index:2147483647;background:#fff;border:2px solid #1890ff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.15);width:480px;max-width:95vw;font-family:"Microsoft JhengHei","Noto Sans TC",Arial,sans-serif;font-size:14px;color:#333;display:none;pointer-events:auto;backdrop-filter:blur(8px);`;
    popover.innerHTML = `
      <div class="citeright-header" style="padding:14px 18px;background:linear-gradient(135deg,#1890ff,#096dd9);color:white;border-bottom:none;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0;cursor:move;user-select:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="citeright-icon" style="font-size:18px;">⚖️</span>
          <span id="citeright-title" style="font-weight:600;font-size:16px;">台灣法源資訊</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="citeright-bookmark" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="加入書籤">📚 書籤</button>
          <button class="citeright-expand" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="展開至側邊面板">📖 展開</button>
          <button class="citeright-close" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;padding:6px;cursor:pointer;font-size:16px;width:28px;height:28px;transition:all 0.2s;">&times;</button>
        </div>
      </div>
      <div class="citeright-loader" style="padding:24px;text-align:center;color:#666;background:white;">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <div style="width:16px;height:16px;border:2px solid #1890ff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          <span>正在查詢法律資料...</span>
        </div>
      </div>
      <div class="citeright-content" style="padding:18px;max-height:320px;overflow-y:auto;display:none;background:white;border-radius:0 0 10px 10px;line-height:1.6;"></div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .citeright-header button:hover { background: rgba(255,255,255,0.3) !important; transform: scale(1.05); }
        .citeright-content::-webkit-scrollbar { width: 6px; }
        .citeright-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        .citeright-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        .citeright-content::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      </style>`;
    document.body.appendChild(popover);

    // Close button event - only hides popover
    popover.querySelector('.citeright-close').addEventListener('click', e => {
        e.stopPropagation();
        popover.style.display = 'none';
        console.log('❌ 彈出視窗已關閉');
    });

    // Bookmark button event
    popover.querySelector('.citeright-bookmark').addEventListener('click', e => {
        e.stopPropagation();
        addToBookmarks();
    });

    // Expand button event - creates side panel
    popover.querySelector('.citeright-expand').addEventListener('click', e => {
        e.stopPropagation();
        openSidePanel();
    });

    // Drag improvements
    let drag = { active: false, offsetX: 0, offsetY: 0 };
    const header = popover.querySelector('.citeright-header');
    header.addEventListener('mousedown', e => {
        if (e.target.classList.contains('citeright-close')) return;
        drag.active = true;
        const rect = popover.getBoundingClientRect();
        drag.offsetX = e.clientX - rect.left;
        drag.offsetY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
        if (!drag.active) return;
        let left = e.clientX - drag.offsetX;
        let top = e.clientY - drag.offsetY;
        left = Math.max(0, Math.min(left, window.innerWidth - popover.offsetWidth));
        top = Math.max(0, Math.min(top, window.innerHeight - 50));
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    });
    window.addEventListener('mouseup', () => { if (drag.active) { drag.active = false; header.style.cursor = 'move'; } });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            isPinned = false;
            popover.style.display = 'none';
            updatePinIndicator();
        }
    });
    return popover;
}

// Create popover
const popover = createPopoverElement();
let hideTimeout;

// Enhanced state management for better UX
let isCtrlPressed = false;    // Current Ctrl key state
let isActivated = false;      // Whether hover mode is activated
let activationTimeout;        // Auto-deactivation timeout
let bookmarkedLaws = [];      // Saved bookmarks

// Helper function to update activation status
function updateActivationStatus() {
    const title = popover.querySelector('#citeright-title');
    if (title) {
        title.textContent = isActivated ? '台灣法源資訊 (滑鼠模式)' : '台灣法源資訊';
    }
}

// Enhanced Ctrl key listeners - toggles hover mode
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !isCtrlPressed) {
        isCtrlPressed = true;
        
        // Ctrl toggles hover mode
        isActivated = !isActivated;
        
        if (isActivated) {
            console.log('⚖️ 滑鼠懸停模式已啟用');
            showActivationNotification('滑鼠懸停模式已啟用', '移動滑鼠至法條引用查看詳情');
            
            // Set auto-deactivation timer (3 minutes)
            clearTimeout(activationTimeout);
            activationTimeout = setTimeout(() => {
                isActivated = false;
                popover.style.display = 'none';
                console.log('⏰ 滑鼠懸停模式已自動停用 (3分鐘無操作)');
                updateActivationStatus();
            }, 180000); // 3 minutes
        } else {
            console.log('❌ 滑鼠懸停模式已停用');
            popover.style.display = 'none';
            clearTimeout(activationTimeout);
            showActivationNotification('滑鼠懸停模式已停用', '再按 Ctrl 重新啟用', '#ff4d4f');
        }
        
        updateActivationStatus();
    }
});

document.addEventListener('keyup', (e) => {
    if (!e.ctrlKey && isCtrlPressed) {
        isCtrlPressed = false;
    }
});

// Show activation notification with custom message
function showActivationNotification(title, subtitle, bgColor = '#52c41a') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2147483648;
        background: ${bgColor}; color: white;
        padding: 12px 16px; border-radius: 8px; font-family: "Microsoft JhengHei";
        font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${isActivated ? '⚖️' : '❌'}</span>
            <span>${title}</span>
        </div>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            ${subtitle}
        </div>
    `;
    
    if (!document.getElementById('slideIn-style')) {
        const style = document.createElement('style');
        style.id = 'slideIn-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2500);
}

// Helper function to check if popover is being hovered
function isPopoverHovered() {
    return popover.matches(':hover') || popover.contains(document.querySelector(':hover'));
}

// Global variable to store current law data for bookmarking
let currentLawData = null;

// Bookmark functionality
function addToBookmarks() {
    if (!currentLawData) {
        console.log('❌ 無法加入書籤：沒有目前的法律資料');
        return;
    }
    
    // Check if already bookmarked
    const exists = bookmarkedLaws.find(item => 
        item.id === currentLawData.id || 
        (item.type === currentLawData.type && item.number === currentLawData.number)
    );
    
    if (exists) {
        showActivationNotification('已存在書籤', '此法條已經在您的書籤中', '#ff9500');
        return;
    }
    
    // Add to bookmarks
    bookmarkedLaws.push({
        id: currentLawData.id || `${currentLawData.type}_${currentLawData.number}`,
        type: currentLawData.type,
        title: currentLawData.title,
        number: currentLawData.number,
        content: currentLawData.content,
        dateAdded: new Date().toISOString()
    });
    
    // Save to localStorage
    localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
    
    showActivationNotification('已加入書籤', `${currentLawData.title}`, '#52c41a');
    console.log('📚 已加入書籤:', currentLawData.title);
}

// Side panel functionality
function openSidePanel() {
    if (!currentLawData) {
        console.log('❌ 無法展開側邊面板：沒有目前的法律資料');
        return;
    }
    
    // Check if side panel already exists
    const existingPanel = document.getElementById('citeright-sidepanel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const sidePanel = document.createElement('div');
    sidePanel.id = 'citeright-sidepanel';
    sidePanel.style.cssText = `
        position: fixed; top: 0; right: 0; width: 450px; height: 100vh; 
        background: white; border-left: 3px solid #1890ff; z-index: 2147483647;
        font-family: "Microsoft JhengHei", Arial, sans-serif; font-size: 14px;
        box-shadow: -8px 0 24px rgba(0,0,0,0.15); transform: translateX(100%);
        transition: transform 0.3s ease-out; overflow: hidden; display: flex; flex-direction: column;
    `;
    
    sidePanel.innerHTML = `
        <div style="background: linear-gradient(135deg, #1890ff, #096dd9); color: white; padding: 20px; flex-shrink: 0;">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">${currentLawData.title}</h2>
                <button id="close-sidepanel" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 8px; cursor: pointer; font-size: 18px; width: 36px; height: 36px; margin-left: auto;">&times;</button>
            </div>
            <div style="font-size: 13px; opacity: 0.9;">
                ${currentLawData.type} · ${currentLawData.number ? `第${currentLawData.number}${currentLawData.type === '釋字' ? '號' : currentLawData.type === '法條' ? '條' : '號'}` : ''}
            </div>
        </div>
        
        <div style="flex: 1; overflow-y: auto; padding: 20px;">
            <div id="sidepanel-content">
                ${currentLawData.fullContent || currentLawData.content || '載入完整內容中...'}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e8e8e8;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1890ff;">相關功能</h3>
                <div style="display: grid; gap: 10px;">
                    <button id="bookmark-from-panel" style="padding: 10px; border: 1px solid #d9d9d9; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                        📚 加入書籤
                    </button>
                    <button id="view-bookmarks" style="padding: 10px; border: 1px solid #d9d9d9; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                        📖 查看我的書籤
                    </button>
                    <button id="official-link" style="padding: 10px; border: 1px solid #d9d9d9; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                        🔗 前往官方頁面
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(sidePanel);
    
    // Show panel with animation
    setTimeout(() => {
        sidePanel.style.transform = 'translateX(0)';
    }, 10);
    
    // Event listeners for side panel
    sidePanel.querySelector('#close-sidepanel').addEventListener('click', () => {
        sidePanel.style.transform = 'translateX(100%)';
        setTimeout(() => sidePanel.remove(), 300);
    });
    
    sidePanel.querySelector('#bookmark-from-panel').addEventListener('click', () => {
        addToBookmarks();
    });
    
    sidePanel.querySelector('#view-bookmarks').addEventListener('click', () => {
        showBookmarksPanel();
    });
    
    sidePanel.querySelector('#official-link').addEventListener('click', () => {
        if (currentLawData.officialUrl) {
            window.open(currentLawData.officialUrl, '_blank');
        }
    });
    
    // Load full content if needed
    if (currentLawData.loadFullContent) {
        currentLawData.loadFullContent().then(content => {
            const contentDiv = sidePanel.querySelector('#sidepanel-content');
            if (contentDiv && content) {
                contentDiv.innerHTML = content;
            }
        });
    }
}

// Show bookmarks panel
function showBookmarksPanel() {
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem('citeright_bookmarks');
    if (savedBookmarks) {
        bookmarkedLaws = JSON.parse(savedBookmarks);
    }
    
    const bookmarksPanel = document.createElement('div');
    bookmarksPanel.id = 'citeright-bookmarks';
    bookmarksPanel.style.cssText = `
        position: fixed; top: 0; right: 450px; width: 400px; height: 100vh;
        background: #f8f9fa; border-left: 2px solid #e8e8e8; z-index: 2147483646;
        font-family: "Microsoft JhengHei"; overflow-y: auto; transform: translateX(100%);
        transition: transform 0.3s ease-out;
    `;
    
    bookmarksPanel.innerHTML = `
        <div style="background: #1890ff; color: white; padding: 20px; position: sticky; top: 0;">
            <div style="display: flex; justify-content: between; align-items: center;">
                <h2 style="margin: 0; font-size: 18px;">📚 我的法律書籤</h2>
                <button id="close-bookmarks" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 6px; cursor: pointer; font-size: 16px; width: 28px; height: 28px; margin-left: auto;">&times;</button>
            </div>
            <div style="font-size: 13px; opacity: 0.9; margin-top: 8px;">
                已儲存 ${bookmarkedLaws.length} 個書籤
            </div>
        </div>
        
        <div style="padding: 20px;">
            ${bookmarkedLaws.length === 0 ? `
                <div style="text-align: center; color: #999; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                    <div>尚未儲存任何書籤</div>
                    <div style="font-size: 12px; margin-top: 8px;">在法條詳情中點擊「加入書籤」來儲存</div>
                </div>
            ` : bookmarkedLaws.map((bookmark, index) => `
                <div class="bookmark-item" data-bookmark-id="${bookmark.id}" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e8e8e8; cursor: pointer; transition: all 0.2s;">
                    <div style="font-weight: 600; color: #1890ff; margin-bottom: 8px;">${bookmark.title}</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        ${bookmark.type} · 儲存於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}
                    </div>
                    <div style="font-size: 13px; color: #555; line-height: 1.5;">
                        ${bookmark.content ? bookmark.content.substring(0, 100) + '...' : '無內容摘要'}
                    </div>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button class="view-bookmark" style="padding: 4px 8px; font-size: 11px; background: #f0f9ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 4px; cursor: pointer;">查看</button>
                        <button class="delete-bookmark" style="padding: 4px 8px; font-size: 11px; background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; border-radius: 4px; cursor: pointer;">刪除</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.body.appendChild(bookmarksPanel);
    
    // Show with animation
    setTimeout(() => {
        bookmarksPanel.style.transform = 'translateX(0)';
    }, 10);
    
    // Event listeners
    bookmarksPanel.querySelector('#close-bookmarks').addEventListener('click', () => {
        bookmarksPanel.style.transform = 'translateX(100%)';
        setTimeout(() => bookmarksPanel.remove(), 300);
    });
    
    // Bookmark item interactions
    bookmarksPanel.querySelectorAll('.view-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            const bookmark = bookmarkedLaws.find(b => b.id === bookmarkId);
            if (bookmark) {
                currentLawData = bookmark;
                openSidePanel();
            }
        });
    });
    
    bookmarksPanel.querySelectorAll('.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
            localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
            e.target.closest('.bookmark-item').remove();
            
            // Update counter
            const counter = bookmarksPanel.querySelector('div[style*="opacity: 0.9"]');
            if (counter) {
                counter.textContent = `已儲存 ${bookmarkedLaws.length} 個書籤`;
            }
        });
    });
}

// Enhanced mouseover event with improved activation logic and database integration
document.addEventListener('mouseover', async (e) => {
    if (e.target.classList.contains('citeright-link')) {
        // Only proceed if extension is activated
        if (!isActivated) {
            return;
        }

        console.log('⚖️ 法律引用偵測:', e.target.textContent);

        const target = e.target;
        const rect = target.getBoundingClientRect();

        // Smart positioning close to underline
        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 8; // Close to underline

        // Keep within screen bounds
        if (left + 480 > window.innerWidth) {
            left = Math.max(10, window.innerWidth - 490);
        }
        if (top + 350 > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - 360; // Show above if no space below
        }

        popover.style.display = 'block';
        popover.style.left = Math.max(10, left) + 'px';
        popover.style.top = Math.max(10, top) + 'px';

        // Update header based on legal type
        const icon = popover.querySelector('#citeright-icon');
        const title = popover.querySelector('#citeright-title');
        const { legalType, caseType, lawName } = target.dataset;
        
        if (legalType === 'law_article') {
            icon.textContent = '📖';
            title.textContent = '台灣法條查詢';
        } else if (caseType === '釋字') {
            icon.textContent = '⚖️';
            title.textContent = '司法院大法官解釋';
        } else {
            icon.textContent = '📋';
            title.textContent = '法院判決查詢';
        }

        // Show loader
        const loader = popover.querySelector('.citeright-loader');
        const content = popover.querySelector('.citeright-content');
        loader.style.display = 'block';
        content.style.display = 'none';

        const { year, number, article, paragraph } = target.dataset;
        
        try {
            let apiUrl = '';
            let response, data;

            if (legalType === 'law_article') {
                // Query law articles from database
                apiUrl = `http://localhost:3000/api/laws/search?q=${encodeURIComponent(lawName)}`;
                response = await fetch(apiUrl);
                data = await response.json();
                
                loader.style.display = 'none';
                content.style.display = 'block';

                if (data.success && data.results.length > 0) {
                    const law = data.results[0];
                    // Get specific article details
                    const articleUrl = `http://localhost:3000/api/laws/${law.id}`;
                    const articleResponse = await fetch(articleUrl);
                    const articleData = await articleResponse.json();
                    
                    // Find matching article
                    const matchingArticle = articleData.articles.find(art => 
                        art.article_number.includes(article) || art.article_number.includes(`第 ${article} 條`)
                    );
                    
                    // Store current law data for bookmarking
                    currentLawData = {
                        id: law.id,
                        type: '法條',
                        title: `${law.law_name}第${article}條`,
                        number: article,
                        content: matchingArticle ? matchingArticle.article_content.substring(0, 500) : '無條文內容',
                        fullContent: matchingArticle ? matchingArticle.article_content : null,
                        officialUrl: law.law_url,
                        lawData: law,
                        articleData: matchingArticle
                    };
                    
                    content.innerHTML = `
                        <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e8e8;">
                            <strong style="color: #1890ff; font-size: 16px;">${law.law_name}</strong>
                            ${law.english_law_name ? `<div style="font-size: 12px; color: #666; margin-top: 2px;">${law.english_law_name}</div>` : ''}
                        </div>
                        
                        <div style="margin-bottom: 8px;">
                            <strong>條文：</strong><span style="color: #1890ff;">${lawName}第${article}條${paragraph ? `第${paragraph}項` : ''}</span>
                        </div>
                        
                        <div style="margin-bottom: 8px;">
                            <strong>法規性質：</strong>${law.law_nature || '一般法律'}
                        </div>
                        
                        <div style="margin-bottom: 8px;">
                            <strong>類別：</strong>${law.law_category || '無分類'}
                        </div>
                        
                        ${matchingArticle ? `
                            <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 12px 0;">
                            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #1890ff;">
                                <div style="font-weight: 600; margin-bottom: 8px; color: #1890ff;">${matchingArticle.article_number}</div>
                                <div style="color: #555; line-height: 1.7;">
                                    ${matchingArticle.article_content ? matchingArticle.article_content.substring(0, 500) : '條文內容載入中...'}
                                    ${matchingArticle.article_content && matchingArticle.article_content.length > 500 ? '...' : ''}
                                </div>
                            </div>
                        ` : `
                            <div style="color: #999; text-align: center; padding: 20px;">
                                <div>📄</div>
                                <div style="margin-top: 8px;">找不到對應條文內容</div>
                            </div>
                        `}
                    `;
                } else {
                    content.innerHTML = `
                        <div style="color: #999; text-align: center; padding: 20px;">
                            <div style="font-size: 24px;">🔍</div>
                            <div style="margin-top: 8px;">找不到相關法條</div>
                            <div style="font-size: 12px; margin-top: 4px;">法條名稱：${lawName}</div>
                        </div>
                    `;
                }

            } else if (caseType === '釋字') {
                // Query constitutional interpretations
                apiUrl = `http://localhost:3000/api/case?caseType=${encodeURIComponent(caseType)}&number=${number}`;
                response = await fetch(apiUrl);
                data = await response.json();
                
                loader.style.display = 'none';
                content.style.display = 'block';

                if (data.success && data.data) {
                    const interp = data.data;
                    
                    // Store current law data for bookmarking
                    currentLawData = {
                        id: `interpretation_${number}`,
                        type: '釋字',
                        title: `司法院釋字第${number}號解釋`,
                        number: number,
                        content: interp.chinese.description ? interp.chinese.description.substring(0, 500) : '無解釋文',
                        fullContent: `
                            ${interp.chinese.issue ? `<h3>解釋爭點</h3><p>${interp.chinese.issue}</p>` : ''}
                            ${interp.chinese.description ? `<h3>解釋文</h3><p>${interp.chinese.description}</p>` : ''}
                            ${interp.chinese.reasoning ? `<h3>解釋理由書</h3><p>${interp.chinese.reasoning}</p>` : ''}
                            ${interp.chinese.fact ? `<h3>事實</h3><p>${interp.chinese.fact}</p>` : ''}
                        `,
                        officialUrl: `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${number}`,
                        interpretationData: interp
                    };
                    
                    content.innerHTML = `
                        <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e8e8;">
                            <strong style="color: #1890ff; font-size: 16px;">司法院釋字第${number}號解釋</strong>
                            ${interp.date ? `<div style="font-size: 12px; color: #666; margin-top: 2px;">解釋日期：${new Date(interp.date).toLocaleDateString('zh-TW')}</div>` : ''}
                        </div>
                        
                        ${interp.chinese.issue ? `
                            <div style="margin-bottom: 12px;">
                                <strong>解釋爭點：</strong>
                                <div style="color: #555; margin-top: 4px; line-height: 1.6;">
                                    ${interp.chinese.issue.substring(0, 300)}${interp.chinese.issue.length > 300 ? '...' : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${interp.chinese.description ? `
                            <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 12px 0;">
                            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #1890ff;">
                                <div style="font-weight: 600; margin-bottom: 8px; color: #1890ff;">解釋文</div>
                                <div style="color: #555; line-height: 1.7;">
                                    ${interp.chinese.description.substring(0, 400)}${interp.chinese.description.length > 400 ? '...' : ''}
                                </div>
                            </div>
                        ` : ''}
                    `;
                } else {
                    content.innerHTML = `
                        <div style="color: #999; text-align: center; padding: 20px;">
                            <div style="font-size: 24px;">📋</div>
                            <div style="margin-top: 8px;">找不到此號解釋</div>
                            <div style="font-size: 12px; margin-top: 4px;">釋字第${number}號</div>
                        </div>
                    `;
                }

            } else {
                // Court cases - placeholder for future implementation
                loader.style.display = 'none';
                content.style.display = 'block';
                content.innerHTML = `
                    <div style="color: #999; text-align: center; padding: 20px;">
                        <div style="font-size: 24px;">🏛️</div>
                        <div style="margin-top: 8px;">法院判決查詢功能開發中</div>
                        <div style="font-size: 12px; margin-top: 4px;">${year}年度${caseType}字第${number}號</div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('API查詢錯誤:', error);
            loader.style.display = 'none';
            content.style.display = 'block';
            content.innerHTML = `
                <div style="color: #ff4d4f; text-align: center; padding: 20px;">
                    <div style="font-size: 24px;">⚠️</div>
                    <div style="margin-top: 8px;">無法連線至法律資料庫</div>
                    <div style="font-size: 12px; margin-top: 4px; color: #666;">請確認後端服務是否正常運行</div>
                </div>
            `;
        }
    }
});

// Click blank area to close popover
document.addEventListener('click', (e) => {
    if (isActivated && popover.style.display === 'block') {
        // Don't close if clicking on popover, legal links, or buttons
        if (!e.target.closest('#citeright-popover') && 
            !e.target.classList.contains('citeright-link') &&
            !e.target.closest('.citeright-link')) {
            popover.style.display = 'none';
        }
    }
});

// Popover now only closes on blank click, not on mouse events

// Enhanced click-to-pin functionality - NEW FEATURE
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('citeright-link')) {
        e.preventDefault();

        // Toggle pin state
        isPinned = !isPinned;

        if (isPinned) {
            console.log('📌 Popover pinned - will stay open until X is clicked');
            clearTimeout(hideTimeout);

            // Show popover immediately when pinned
            showPopoverForTarget(e.target);

            // Update visual indicator
            updatePinIndicator();
        } else {
            console.log('📌 Popover unpinned');
            updatePinIndicator();

            // Start hide timer if not hovering
            // Removed auto-hide timeout - only close on blank click
        }
    }
});

// Helper function to show popover for specific target
async function showPopoverForTarget(target) {
    console.log('🎯 Showing popover for:', target.textContent);

    const rect = target.getBoundingClientRect();

    // Smart positioning close to underline
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8; // Close to underline

    // Keep within screen bounds
    if (left + 450 > window.innerWidth) {
        left = Math.max(10, window.innerWidth - 460);
    }
    if (top + 350 > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - 360; // Show above if no space below
    }

    popover.style.display = 'block';
    popover.style.left = Math.max(10, left) + 'px';
    popover.style.top = Math.max(10, top) + 'px';

    // Show loader
    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');
    loader.style.display = 'block';
    content.style.display = 'none';

    const { year, caseType, number } = target.dataset;
    console.log('Case data:', { year, caseType, number });

    if (!caseType || !number) {
        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = `<div style="color: #d32f2f; padding: 12px;">此案號格式暫不支援查詢</div>`;
        return;
    }

    try {
        const apiUrl = caseType === '釋字'
            ? `http://localhost:3000/api/case?caseType=${encodeURIComponent(caseType)}&number=${number}`
            : `http://localhost:3000/api/case?year=${year}&caseType=${encodeURIComponent(caseType)}&number=${number}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        loader.style.display = 'none';
        content.style.display = 'block';

        if (data.error) {
            content.innerHTML = `<div style="color: #d32f2f; padding: 12px;">${data.error}</div>`;
        } else {
            const caseData = data.data || data;
            content.innerHTML = `
                <div style="margin-bottom: 8px;"><strong>案由：</strong> ${caseData.JTITLE || '無資料'}</div>
                <div style="margin-bottom: 8px;"><strong>案號：</strong> ${data.caseNumber || (caseData.JYEAR + '年度' + caseData.JCASE + '字第' + caseData.JNO + '號')}</div>
                <div style="margin-bottom: 8px;"><strong>法院：</strong> ${caseData.JCOURT || '無資料'}</div>
                <div style="margin-bottom: 8px;"><strong>日期：</strong> ${caseData.JDATE || '無資料'}</div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;">
                <div style="color: #555; background: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 4px solid #1890ff;">
                    ${(caseData.JFULLCONTENT || caseData.JFULL || '暫無內容').substring(0, 400)}...
                </div>
            `;
        }
    } catch (error) {
        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = `<div style="color: #d32f2f; padding: 12px;">無法連線至後端服務</div>`;
    }
}

// Update pin indicator
function updatePinIndicator() {
    const header = popover.querySelector('.citeright-header');
    const title = header.querySelector('span');

    if (isPinned) {
        title.innerHTML = '📌 判決摘要';
        header.style.background = 'linear-gradient(45deg, #f8f9fa, #e3f2fd)';
        header.style.borderBottom = '1px solid #2196f3';
    } else {
        title.innerHTML = '📄 判決摘要';
        header.style.background = '#f8f9fa';
        header.style.borderBottom = '1px solid #dee2e6';
    }
}

// MutationObserver to handle dynamically loaded content
(function setupObserver(){
    function safeHighlight(){
        try { highlightCitations(); } catch (e) { console.error('Highlight error', e); }
    }
    if (!document.body) { return document.addEventListener('DOMContentLoaded', safeHighlight); }
    const observer = new MutationObserver(mutations => {
        let textAdded = false;
        for (const m of mutations) {
            if (m.type === 'childList') {
                if ([...m.addedNodes].some(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === 1 && n.innerText))) {
                    textAdded = true; break;
                }
            } else if (m.type === 'characterData') { textAdded = true; break; }
        }
        if (textAdded) safeHighlight();
    });
    try {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        console.log('🔁 MutationObserver active');
    } catch (e) {
        console.warn('Observer failed to start', e.message);
    }
})();

// Initialize extension (modified logging)
function initializeExtension() {
    console.log('🔍 法源探測器 (CiteRight) 啟動 - 正在掃描頁面案號');
    // Add CSS (ensure not duplicated)
    if (!document.getElementById('citeright-style')) {
        const style = document.createElement('style');
        style.id = 'citeright-style';
        style.textContent = `
        .citeright-link { 
            background: linear-gradient(120deg, #e6f7ff 0%, #f0f9ff 100%) !important; 
            border-bottom: 2px dotted #1890ff !important; 
            cursor: pointer !important; 
            transition: all .3s ease !important; 
            padding: 2px 4px !important; 
            border-radius: 4px !important; 
            position: relative !important; 
            font-weight: 500 !important;
            box-shadow: 0 1px 3px rgba(24,144,255,0.1) !important;
        }
        .citeright-link:hover { 
            background: linear-gradient(120deg, #bae7ff 0%, #e6f7ff 100%) !important; 
            border-bottom: 2px solid #1890ff !important; 
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 8px rgba(24,144,255,0.2) !important;
        }
        .citeright-link[data-legal-type="law_article"] { 
            border-bottom-color: #52c41a !important; 
            background: linear-gradient(120deg, #f6ffed 0%, #f0f9ff 100%) !important; 
        }
        .citeright-link[data-legal-type="interpretation"] { 
            border-bottom-color: #722ed1 !important; 
            background: linear-gradient(120deg, #f9f0ff 0%, #f0f9ff 100%) !important; 
        }
        .citeright-link:hover::after { 
            content: attr(title) !important; 
            position: absolute !important; 
            bottom: 100% !important; 
            left: 50% !important; 
            transform: translateX(-50%) !important; 
            background: rgba(0,0,0,0.8) !important; 
            color: white !important; 
            padding: 6px 10px !important; 
            border-radius: 6px !important; 
            font-size: 12px !important; 
            white-space: nowrap !important; 
            z-index: 10000 !important; 
            pointer-events: none !important;
            font-weight: normal !important;
            backdrop-filter: blur(4px) !important;
        }
        .citeright-link:hover::before { 
            content: "" !important; 
            position: absolute !important; 
            bottom: 100% !important; 
            left: 50% !important; 
            transform: translateX(-50%) translateY(100%) !important; 
            border: 5px solid transparent !important; 
            border-top-color: rgba(0,0,0,0.8) !important; 
            z-index: 10000 !important; 
            pointer-events: none !important; 
        }
        `;
        document.head.appendChild(style);
    }
    setTimeout(() => {
        const count = highlightCitations();
        if (count === 0) {
            // Provide sample test output
            const testText = '在110年度台上字第3214號判決中，以及釋字第748號與109年憲判字第13號';
            Object.entries(TAIWAN_CASE_PATTERNS).forEach(([k,p]) => {
                const m = testText.match(new RegExp(p.source, p.flags));
                console.log('Pattern test', k, m);
            });
        }
    }, 300);
}

// Listen for messages from background script (context menu activation)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "activateCiteRight") {
        isActivated = true;
        isPinned = false;
        console.log('⚖️ 透過右鍵選單啟用台灣法源探測器');
        showActivationNotification();
        updatePinIndicator();
        
        // If there's selected text, try to highlight it immediately
        if (message.selectedText) {
            console.log('📝 選取文字:', message.selectedText);
            // Re-run highlighting to catch any new legal references
            highlightCitations();
        }
        
        // Set auto-deactivation timer
        clearTimeout(activationTimeout);
        activationTimeout = setTimeout(() => {
            if (!isPinned) {
                isActivated = false;
                popover.style.display = 'none';
                console.log('⏰ 法源探測器已自動停用 (5分鐘無操作)');
            }
        }, 300000);
        
        sendResponse({ success: true });
    } else if (message.action === "deactivateCiteRight") {
        isActivated = false;
        isPinned = false;
        popover.style.display = 'none';
        clearTimeout(activationTimeout);
        console.log('❌ 透過右鍵選單停用台灣法源探測器');
        updatePinIndicator();
        sendResponse({ success: true });
    }
});

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}
