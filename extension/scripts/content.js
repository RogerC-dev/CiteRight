// content.js - 台灣法源探測器 (CiteRight)
// 整合台灣法律資料庫，支援法條、釋字、判決自動識別

const TAIWAN_LEGAL_PATTERNS = {
    test: /憲法第[0-9]+條|集會遊行法第[0-9]+條第[0-9]+項/g,
    // 法院判決: 110年度上字第1234號
    court_case: /([0-9０-９]{2,3})\s*年度?\s*([\u4e00-\u9fa5]{1,6}?)\s*字\s*第\s*([0-9０-９]+)\s*號/g,
    // 憲法法庭: 111年憲判字第13號
    constitutional: /([0-9０-９]{2,3})\s*年\s*憲判字\s*第\s*([0-9０-９]+)\s*號/g,
    // 司法院大法官解釋: 釋字第748號
    interpretation: /釋字第\s*([0-9０-９]+)\s*號/g,
    // 法條引用: 民法第184條、刑法第271條第1項、民法第一八四條、刑法第三百二十條第一項第二項
    law_article: /(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])([\u4e00-\u9fa5]{2,8}法)第\s*([0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\s*條之\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)?)\s*條(?:第\s*([0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\s*項第\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)*)\s*[項款目])?/g,
    // Mixed law references: 第964條、第965條 (when previous law name should be inferred)
    mixed_law_article: /(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])第\s*([0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\s*條之\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)?)\s*條(?:第\s*([0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\s*項第\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)*)\s*[項款目])?/g
};

function toHalfWidthDigits(str) {
    return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30));
}

function chineseToArabic(str) {
    // Convert Chinese numerals to Arabic numerals
    const chineseNums = {
        '零': 0, '○': 0,
        '一': 1, '壹': 1,
        '二': 2, '貳': 2,
        '三': 3, '參': 3,
        '四': 4, '肆': 4,
        '五': 5, '伍': 5,
        '六': 6, '陸': 6,
        '七': 7, '柒': 7,
        '八': 8, '捌': 8,
        '九': 9, '玖': 9,
        '十': 10, '拾': 10,
        '百': 100, '佰': 100,
        '千': 1000, '仟': 1000,
        '萬': 10000
    };

    let result = str;

    // Handle complex Chinese numbers first (e.g., 九百六十四 -> 964)
    // Match patterns like 九百六十四, 三百二十, etc.
    result = result.replace(/(一|二|三|四|五|六|七|八|九|壹|貳|參|肆|伍|陸|柒|捌|玖)?(百|佰)?(一|二|三|四|五|六|七|八|九|壹|貳|參|肆|伍|陸|柒|捌|玖)?(十|拾)?(一|二|三|四|五|六|七|八|九|壹|貳|參|肆|伍|陸|柒|捌|玖)?/g, (match) => {
        if (match.length === 0) return match;

        let total = 0;
        let current = 0;
        let i = 0;

        while (i < match.length) {
            const char = match[i];
            const num = chineseNums[char];

            if (num !== undefined) {
                if (num >= 100) {
                    if (current === 0) current = 1;
                    total += current * num;
                    current = 0;
                } else if (num === 10) {
                    if (current === 0) current = 1;
                    current *= 10;
                } else {
                    current = num;
                }
            }
            i++;
        }

        total += current;
        return total > 0 ? total.toString() : match;
    });

    // Handle simple digit-by-digit replacements (e.g., 一八四 -> 184)
    for (const [chinese, arabic] of Object.entries(chineseNums)) {
        if (arabic < 10) {
            result = result.replace(new RegExp(chinese, 'g'), arabic.toString());
        }
    }

    // Clean up any remaining non-numeric Chinese characters
    result = result.replace(/[十百千萬拾佰仟]/g, '');

    return result;
}

// Context tracking for mixed law references
let lastLawName = '';

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
        lastLawName = lawName; // Store for mixed references
        article = chineseToArabic(toHalfWidthDigits(groups[1])); // 184、271條之1、一八四、三百二十
        paragraph = groups[2] ? formatParagraphForDB(chineseToArabic(toHalfWidthDigits(groups[2]))) : ''; // 第1項、第一項第二項 -> -1, -1-2
        caseType = '法條';
    } else if (key === 'mixed_law_article') {
        lawName = lastLawName; // Use the last seen law name
        article = chineseToArabic(toHalfWidthDigits(groups[0])); // 964、965等
        paragraph = groups[1] ? formatParagraphForDB(chineseToArabic(toHalfWidthDigits(groups[1]))) : ''; // 第1項 -> -1
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

// Format paragraph numbers for database lookup (第1項 -> -1, 第1項第2款 -> -1-2)
function formatParagraphForDB(paragraphStr) {
    if (!paragraphStr) return '';

    // Handle multiple items like "1項第2款" -> "1-2"
    const parts = paragraphStr.split(/項第?|款第?|目第?/).filter(part => part.trim());

    if (parts.length === 0) return '';
    if (parts.length === 1) return '-' + parts[0];

    return '-' + parts.join('-');
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

        // Skip bookmark panel content completely, but allow side panel content with legal highlighting
        if (node.parentNode.closest && node.parentNode.closest('#citeright-bookmarks-panel')) return;

        // Skip side panel headers (blue title column) but allow content area
        const sidePanelHeader = node.parentNode.closest && node.parentNode.closest('#citeright-sidepanel > div:first-child');
        if (sidePanelHeader) return;

        // Skip any elements with blue background (title columns)
        const hasBlueBackground = node.parentNode.closest && node.parentNode.closest('[style*="background: linear-gradient(135deg, #1890ff"]');
        if (hasBlueBackground) return;

        // Allow highlighting in legal content areas of side panel
        const isInLegalContentArea = node.parentNode.closest && node.parentNode.closest('.legal-content-area');
        const isInSidepanelContent = node.parentNode.closest && node.parentNode.closest('#sidepanel-content');
        if (isInLegalContentArea || isInSidepanelContent) {
            // Continue with highlighting for legal content
        }
        const original = node.textContent;
        if (!original || !original.trim()) return;

        let newHTML = chineseToArabic(original);
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

// Helper function to highlight citations in a specific element
function highlightCitationsInElement(element) {
    console.log('🔍 Applying highlighting to element:', element);
    const seenNodes = new WeakSet();
    let created = 0;

    function processTextNode(node) {
        if (seenNodes.has(node)) return;
        if (!node.parentNode) return;

        // Skip inside our own spans or script/style/inputs
        const parentTag = node.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'INPUT') return;
        if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return;

        // Skip bookmark panel content
        if (node.parentNode.closest && node.parentNode.closest('#citeright-bookmarks-panel')) return;

        // Skip elements with blue background (title columns)
        const hasBlueBackground = node.parentNode.closest && node.parentNode.closest('[style*="background: linear-gradient(135deg, #1890ff"]');
        if (hasBlueBackground) return;

        const original = node.textContent;
        if (!original || !original.trim()) return;

        let newHTML = original;
        let changed = false;
        for (const [key, pattern] of Object.entries(TAIWAN_LEGAL_PATTERNS)) {
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

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent || !/[字號釋憲判第度年]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const batch = [];
    while (walker.nextNode()) {
        batch.push(walker.currentNode);
    }
    batch.forEach(processTextNode);

    console.log(`✨ Applied highlighting to ${created} legal references in element`);
    return created;
}

// Get current session statistics
function getSessionStats() {
    const stats = {
        hoverCounts: Object.fromEntries(sessionLawCount),
        currentlyActive: activePopupLaw,
        currentlyHovered: currentHoveredLaw
    };
    console.log('📈 Session Statistics:', stats);
    return stats;
}

// Reset session data
function resetSessionData() {
    sessionLawCount.clear();
    activePopupLaw = null;
    currentHoveredLaw = null;
    popover.style.display = 'none';
    console.log('🔄 Reset session data');
}

// Expose for manual debug
if (typeof window !== 'undefined') {
    window.citerightForceHighlight = highlightCitations;
    window.citerightHighlightElement = highlightCitationsInElement;
    window.citerightSessionStats = getSessionStats;
    window.citerightResetSession = resetSessionData;
}

function createPopoverElement() {
    // Remove any existing popover
    const existing = document.getElementById('citeright-popover');
    if (existing) existing.remove();
    const popover = document.createElement('div');
    popover.id = 'citeright-popover';
    popover.style.cssText = `position:fixed;z-index:2147483650;background:#fff;border:2px solid #1890ff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.15);width:480px;max-width:95vw;font-family:"Microsoft JhengHei","Noto Sans TC",Arial,sans-serif;font-size:14px;color:#333;display:none;pointer-events:auto;backdrop-filter:blur(8px);`;
    popover.innerHTML = `
      <div class="citeright-header" style="padding:14px 18px;background:linear-gradient(135deg,#1890ff,#096dd9);color:white;border-bottom:none;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0;cursor:move;user-select:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="citeright-icon" style="font-size:18px;">⚖️</span>
          <span id="citeright-title" style="font-weight:600;font-size:16px;color:#f0f8ff;text-shadow: 1px 1px 3px rgba(0,0,0,0.5);opacity:0.95;">台灣法源資訊</span>
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
        console.log('🔧 Expand button clicked, currentLawData:', currentLawData);
        
        if (!currentLawData) {
            console.log('❌ No currentLawData, attempting to load from popup');
            // Try to extract data from popup if currentLawData is missing
            const title = popover.querySelector('#citeright-title').textContent;
            const content = popover.querySelector('.citeright-content').innerHTML;
            if (title && content) {
                currentLawData = {
                    id: 'popup_' + Date.now(),
                    title: title,
                    type: '法律資訊',
                    content: content,
                    fullContent: content
                };
                console.log('✅ Created currentLawData from popup content');
            }
        }
        
        openSidePanel();
        
        // Hide the popup after opening sidebar
        popover.style.display = 'none';
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
            popover.style.display = 'none';
        }
    });
    return popover;
}

// Create popover
const popover = createPopoverElement();
let hideTimeout;
let showTimeout;              // Delay before showing popover
let currentHoveredLaw = null; // Track currently hovered law to prevent duplicates
let activePopupLaw = null;    // Track law currently shown in popup to prevent duplicates
let popupCooldown = false;    // Prevent rapid popup opening
let sessionLawCount = new Map(); // Count how many times each law has been hovered

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

// Helper function to generate unique law identifier
function getLawIdentifier(target) {
    const { legalType, caseType, lawName, article, paragraph, year, number } = target.dataset;
    if (legalType === 'law_article') {
        return `${lawName}第${article}條${paragraph ? `第${paragraph}項` : ''}`;
    } else if (caseType === '釋字') {
        return `釋字第${number}號`;
    } else {
        return `${year}年${caseType}字第${number}號`;
    }
}

// Enhanced Ctrl key listeners - toggles hover mode
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !isCtrlPressed) {
        isCtrlPressed = true;

        // Check if extension is globally enabled first
        if (!isExtensionEnabled) {
            showActivationNotification('擴充功能已停用', '請在工具列圖示中啟用擴充功能', '#d73527');
            return;
        }

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
            showActivationNotification('滑鼠懸停模式已停用', '再按 Ctrl 重新啟用', '#d73527');
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
function showActivationNotification(title, subtitle, bgColor = '#389e0d') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2147483648;
        background: ${bgColor}; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        padding: 12px 16px; border-radius: 8px; font-family: "Microsoft JhengHei";
        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
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
        showActivationNotification('已存在書籤', '此法條已經在您的書籤中', '#e67e22');
        return;
    }

    // Add to bookmarks with full content
    bookmarkedLaws.push({
        id: currentLawData.id || `${currentLawData.type}_${currentLawData.number}`,
        type: currentLawData.type,
        title: currentLawData.title,
        number: currentLawData.number,
        content: currentLawData.fullContent || currentLawData.content, // Save full content
        fullContent: currentLawData.fullContent || currentLawData.content, // Ensure fullContent is available
        officialUrl: currentLawData.officialUrl,
        lawData: currentLawData.lawData,
        articleData: currentLawData.articleData,
        dateAdded: new Date().toISOString()
    });

    // Save to localStorage
    localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));

    showActivationNotification('已加入書籤', `${currentLawData.title}`, '#52c41a');
    console.log('📚 已加入書籤:', currentLawData.title);
}

// Create main sidebar with tabs
function createMainSidebar() {
    // Remove any existing sidebar
    const existingSidebar = document.getElementById('citeright-main-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }

    // Create web content overlay to adjust main content
    createWebContentOverlay();

    const mainSidebar = document.createElement('div');
    mainSidebar.id = 'citeright-main-sidebar';
    mainSidebar.className = 'citeright-sidebar';

    mainSidebar.innerHTML = `
        <div id="resize-handle" style="position: absolute; left: -3px; top: 0; bottom: 0; width: 6px; background: #1890ff; cursor: ew-resize; z-index: 1; opacity: 0.7; transition: opacity 0.2s;"></div>
        
        <!-- Tab Navigation -->
        <div style="background: linear-gradient(135deg, #1890ff, #096dd9); color: white; padding: 16px; flex-shrink: 0;">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">CiteRight 工具面板</h2>
                <button id="close-main-sidebar" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 8px; cursor: pointer; font-size: 18px; width: 36px; height: 36px;">&times;</button>
            </div>
            
            <div class="tab-navigation" style="display: flex; gap: 8px;">
                <button id="tab-tool" class="tab-btn active" data-tab="tool">
                    🔧 法律工具
                </button>
                <button id="tab-bookmarks" class="tab-btn" data-tab="bookmarks">
                    📚 我的書籤
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
    `;

    document.body.appendChild(mainSidebar);

    // Show sidebar with animation
    setTimeout(() => {
        mainSidebar.style.transform = 'translateX(0)';
        adjustWebContentForSidebar(450);
    }, 10);

    setupSidebarEventListeners(mainSidebar);
    loadBookmarksContent();
    
    return mainSidebar;
}

// Create web content overlay to resize main content
function createWebContentOverlay() {
    const existing = document.getElementById('citeright-web-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'citeright-web-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        z-index: 2147483640; pointer-events: none; 
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: rgba(0, 0, 0, 0.02);
    `;
    document.body.appendChild(overlay);
}

// Adjust web content when sidebar opens
function adjustWebContentForSidebar(sidebarWidth) {
    console.log('🔧 Adjusting web content for sidebar width:', sidebarWidth);
    
    // Remove overlay approach, directly modify body and html
    const overlay = document.getElementById('citeright-web-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Set CSS custom property for reference
    document.documentElement.style.setProperty('--citeright-sidebar-width', sidebarWidth + 'px');
    
    // Apply direct body and html adjustments for maximum compatibility
    if (sidebarWidth > 0) {
        // Make the entire viewport narrower
        document.documentElement.style.width = `calc(100vw - ${sidebarWidth}px)`;
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Adjust body
        document.body.style.width = '100%';
        document.body.style.maxWidth = '100%';
        document.body.style.overflow = 'hidden';
        document.body.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        console.log('✅ Web content made narrower to accommodate sidebar');
    } else {
        // Restore full width
        document.documentElement.style.width = '100vw';
        document.documentElement.style.overflow = 'auto';
        document.body.style.width = '';
        document.body.style.maxWidth = '';
        document.body.style.overflow = '';
        
        // Clean up transitions after animation
        setTimeout(() => {
            document.documentElement.style.transition = '';
            document.body.style.transition = '';
        }, 300);
        
        console.log('✅ Web content restored to full width');
    }
    
    // Dispatch event for third-party compatibility
    window.dispatchEvent(new CustomEvent('citeright-sidebar-resize', {
        detail: { sidebarWidth: sidebarWidth }
    }));
}

// Setup event listeners for sidebar
function setupSidebarEventListeners(sidebar) {
    // Tab switching
    const tabButtons = sidebar.querySelectorAll('.tab-btn');
    const tabContents = sidebar.querySelectorAll('.tab-content');
    
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
            
            // Load content if switching to bookmarks
            if (targetTab === 'bookmarks') {
                loadBookmarksContent();
            }
        });
    });

    // Close button
    sidebar.querySelector('#close-main-sidebar').addEventListener('click', () => {
        closeSidebar();
    });

    // Resize functionality
    setupSidebarResize(sidebar);
}

// Setup sidebar resize functionality
function setupSidebarResize(sidebar) {
    const resizeHandle = sidebar.querySelector('#resize-handle');
    let isResizing = false;
    let startX = 0;
    let startWidth = 450;

    resizeHandle.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
    });

    resizeHandle.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0.7';
        }
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = startX - e.clientX; // Reverse for right-side panel
        let newWidth = startWidth + deltaX;

        // Apply constraints
        newWidth = Math.max(350, Math.min(newWidth, window.innerWidth * 0.8));

        sidebar.style.width = newWidth + 'px';
        adjustWebContentForSidebar(newWidth);
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizeHandle.style.opacity = '0.7';
        }
    });
}

// Close sidebar and restore web content
function closeSidebar() {
    const sidebar = document.getElementById('citeright-main-sidebar');
    if (sidebar) {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => sidebar.remove(), 300);
        adjustWebContentForSidebar(0);
    }
    
    const overlay = document.getElementById('citeright-web-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Load bookmarks content
function loadBookmarksContent() {
    const savedBookmarks = localStorage.getItem('citeright_bookmarks');
    if (savedBookmarks) {
        bookmarkedLaws = JSON.parse(savedBookmarks);
    }

    const bookmarksContent = document.getElementById('bookmarks-content');
    if (!bookmarksContent) return;

    if (bookmarkedLaws.length === 0) {
        bookmarksContent.innerHTML = `
            <div style="text-align: center; color: #999; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                <div>尚未儲存任何書籤</div>
                <div style="font-size: 12px; margin-top: 8px;">在法條詳情中點擊「加入書籤」來儲存</div>
            </div>
        `;
        return;
    }

    bookmarksContent.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; color: #1890ff;">我的法律書籤 (${bookmarkedLaws.length})</h3>
        </div>
        ${bookmarkedLaws.map((bookmark, index) => `
            <div class="bookmark-item" data-bookmark-id="${bookmark.id}" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e8e8e8; cursor: pointer; transition: all 0.2s;">
                <div style="font-weight: 600; color: #1890ff; margin-bottom: 8px;">${bookmark.title}</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    ${bookmark.type} · 儲存於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}
                </div>
                <div style="font-size: 13px; color: #555; line-height: 1.5;">
                    ${bookmark.content ? bookmark.content.substring(0, 100) + (bookmark.content.length > 100 ? '...' : '') : '無內容摘要'}
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="view-bookmark" style="padding: 4px 8px; font-size: 11px; background: #f0f9ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 4px; cursor: pointer;">查看</button>
                    <button class="delete-bookmark" style="padding: 4px 8px; font-size: 11px; background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; border-radius: 4px; cursor: pointer;">刪除</button>
                </div>
            </div>
        `).join('')}
    `;

    // Setup bookmark interactions
    bookmarksContent.querySelectorAll('.view-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            const bookmark = bookmarkedLaws.find(b => b.id === bookmarkId);
            if (bookmark) {
                loadBookmarkInToolTab(bookmark);
            }
        });
    });

    bookmarksContent.querySelectorAll('.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
            localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
            loadBookmarksContent(); // Refresh the list
        });
    });
}

// Load bookmark content in tool tab
function loadBookmarkInToolTab(bookmark) {
    // Switch to tool tab
    const toolTabBtn = document.getElementById('tab-tool');
    const bookmarkTabBtn = document.getElementById('tab-bookmarks');
    const toolContent = document.getElementById('tab-content-tool');
    const bookmarkContent = document.getElementById('tab-content-bookmarks');
    
    if (toolTabBtn && bookmarkTabBtn && toolContent && bookmarkContent) {
        // Update tab buttons
        toolTabBtn.classList.add('active');
        bookmarkTabBtn.classList.remove('active');
        
        // Update content visibility
        toolContent.classList.add('active');
        bookmarkContent.classList.remove('active');
    }
    
    // Load content into tool tab
    const toolContentDiv = document.getElementById('tool-content');
    if (toolContentDiv && bookmark) {
        console.log('📝 Loading content for bookmark:', bookmark.title);
        
        // Update currentLawData
        currentLawData = {
            ...bookmark,
            content: bookmark.fullContent || bookmark.content,
            fullContent: bookmark.fullContent || bookmark.content
        };
        
        // Clean and prepare content
        const displayContent = bookmark.fullContent || bookmark.content || '無內容可顯示';
        const cleanContent = displayContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
        
        toolContentDiv.innerHTML = `
            <div style="margin-bottom: 16px; padding: 16px; background: linear-gradient(135deg, #f0f9ff, #e6f7ff); border-radius: 8px; border-left: 4px solid #1890ff;">
                <h3 style="margin: 0 0 8px 0; color: #1890ff; font-size: 18px;">${bookmark.title}</h3>
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                    📝 ${bookmark.type} ${bookmark.number ? `· 第${bookmark.number}${bookmark.type === '釋字' ? '號' : '條'}` : ''} · ${bookmark.dateAdded ? new Date(bookmark.dateAdded).toLocaleDateString('zh-TW') : '未知日期'}
                </div>
            </div>
            
            <div id="tool-main-content" class="legal-content-area" style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e8e8e8; color: #333; line-height: 1.8; font-size: 15px; min-height: 200px;">
                ${cleanContent}
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: #fafafa; border-radius: 8px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1890ff;">📋 相關功能</h4>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="add-to-bookmarks" style="padding: 8px 12px; border: 1px solid #52c41a; background: #f6ffed; color: #52c41a; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">📚 重新加入書籤</button>
                    ${bookmark.officialUrl ? `<button id="official-link" style="padding: 8px 12px; border: 1px solid #1890ff; background: #f0f9ff; color: #1890ff; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">🔗 官方頁面</button>` : ''}
                    <button id="remove-from-bookmarks" style="padding: 8px 12px; border: 1px solid #ff4d4f; background: #fff2f0; color: #ff4d4f; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">🗑️ 移除書籤</button>
                </div>
            </div>
        `;
        
        console.log('✅ Content loaded successfully in tool tab');
        
        // Setup action buttons
        const officialLink = toolContentDiv.querySelector('#official-link');
        if (officialLink && bookmark.officialUrl) {
            officialLink.addEventListener('click', () => {
                window.open(bookmark.officialUrl, '_blank');
            });
        }
        
        const removeBtn = toolContentDiv.querySelector('#remove-from-bookmarks');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmark.id);
                localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
                loadBookmarksContent(); // Refresh bookmark list
                
                // Clear tool content
                toolContentDiv.innerHTML = `
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔧</div>
                        <div>書籤已移除</div>
                        <div style="font-size: 12px; margin-top: 8px;">請點擊法律條文來查看詳細資訊</div>
                    </div>
                `;
            });
        }
        
        // Apply highlighting to the new content
        setTimeout(() => {
            const contentDiv = toolContentDiv.querySelector('#tool-main-content');
            if (contentDiv) {
                highlightCitationsInElement(contentDiv);
            }
        }, 100);
    }
}

// Side panel functionality (modified to use main sidebar)
function openSidePanel() {
    console.log('🔧 Opening side panel with data:', currentLawData);
    
    if (!currentLawData) {
        console.log('❌ 無法展開側邊面板：沒有目前的法律資料');
        alert('❌ 無法展開側邊面板：沒有目前的法律資料。請先點擊法律條文。');
        return;
    }

    // Remove any existing sidebar first
    const existingSidebar = document.getElementById('citeright-main-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }

    // Create fresh sidebar
    const sidebar = createMainSidebar();
    console.log('✅ Sidebar created');
    
    // Ensure the sidebar is shown with animation
    setTimeout(() => {
        sidebar.classList.add('open');
        sidebar.style.transform = 'translateX(0)';
        console.log('✅ Sidebar animation triggered');
    }, 50);
    
    // Switch to tool tab and load content after a short delay
    setTimeout(() => {
        loadBookmarkInToolTab(currentLawData);
        console.log('✅ Content loaded in tool tab');
    }, 200);
}

// Show bookmarks panel
function showBookmarksPanel() {
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem('citeright_bookmarks');
    if (savedBookmarks) {
        bookmarkedLaws = JSON.parse(savedBookmarks);
    }

    // Calculate side panel width for proper positioning
    const sidePanel = document.querySelector('#citeright-sidepanel');
    const sidePanelWidth = sidePanel ? parseInt(window.getComputedStyle(sidePanel).width, 10) : 450;

    const bookmarksPanel = document.createElement('div');
    bookmarksPanel.id = 'citeright-bookmarks-panel';
    bookmarksPanel.style.cssText = `
        position: fixed; top: 0; right: ${sidePanelWidth}px; width: 400px; height: 100vh;
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
                // Ensure we have full content for bookmarks
                currentLawData = {
                    ...bookmark,
                    content: bookmark.fullContent || bookmark.content,
                    fullContent: bookmark.fullContent || bookmark.content
                };
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
    // Prevent popup triggers when hovering over the popup itself or its children
    if (e.target.closest('#citeright-popover') || e.target.id === 'citeright-popover') {
        return;
    }

    if (e.target.classList.contains('citeright-link')) {
        // Check if extension is globally enabled
        if (!isExtensionEnabled) {
            return;
        }

        // Also check activation state
        if (!isActivated) {
            return;
        }

        // Clear any existing hide timeout when hovering a new law
        clearTimeout(hideTimeout);

        // Improved duplicate prevention - only prevent if popup is currently open
        const lawId = getLawIdentifier(e.target);

        // Track hover count for this law
        const hoverCount = sessionLawCount.get(lawId) || 0;
        sessionLawCount.set(lawId, hoverCount + 1);

        // Only prevent if same law popup is currently displayed
        if (activePopupLaw === lawId && popover.style.display === 'block') {
            console.log(`⛔ Same law popup already open (hover #${hoverCount}):`, lawId);
            return;
        }

        // This check is now handled above, remove duplicate

        // Don't show popup if in cooldown period for any law
        if (popupCooldown) {
            return;
        }

        // If different law is showing, hide current popup first
        if (activePopupLaw && activePopupLaw !== lawId && popover.style.display === 'block') {
            popover.style.display = 'none';
            activePopupLaw = null;
            // Small delay before showing new popup for different law
            setTimeout(() => {
                if (!popupCooldown) {
                    showNewPopup();
                }
            }, 100);
            return;
        }

        showNewPopup();

        function showNewPopup() {

            currentHoveredLaw = lawId;

            // Clear any existing timeouts
            clearTimeout(showTimeout);
            clearTimeout(hideTimeout);

            // Set cooldown and update tracking
            popupCooldown = true;
            setTimeout(() => { popupCooldown = false; }, 400); // 400ms cooldown

            currentHoveredLaw = lawId;
            activePopupLaw = lawId;

            console.log(`✨ Showing law popup (hover #${hoverCount}):`, lawId);

            // Small delay before showing popover for better UX
            showTimeout = setTimeout(async () => {
                console.log('⚖️ 法律引用偵測:', e.target.textContent);

                const target = e.target;
                const rect = target.getBoundingClientRect();

                // Smart positioning close to underline
                let left = rect.left + window.scrollX;
                let top = rect.bottom + window.scrollY + 8; // Close to underline

                // Keep within screen bounds - improved boundary detection
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const scrollTop = window.scrollY;
                const scrollLeft = window.scrollX;

                // Horizontal bounds check
                if (left + 480 > scrollLeft + viewportWidth) {
                    left = Math.max(scrollLeft + 10, scrollLeft + viewportWidth - 490);
                }
                if (left < scrollLeft + 10) {
                    left = scrollLeft + 10;
                }

                // Vertical bounds check
                if (top + 350 > scrollTop + viewportHeight) {
                    top = rect.top + scrollTop - 360; // Show above if no space below
                }
                if (top < scrollTop + 10) {
                    top = scrollTop + 10; // Don't go above viewport
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

                            // Find matching article (handle different DB formats)
                            let matchingArticle = articleData.articles.find(art => {
                                const artNum = art.article_number;
                                // Try different matching patterns
                                return artNum.includes(article) ||
                                    artNum.includes(`第 ${article} 條`) ||
                                    artNum.includes(`${article}-`) || // For paragraph format like "188-1"
                                    (paragraph && artNum.includes(`${article}${paragraph}`)); // For "188-1" format
                            });

                            // If paragraph specified but no exact match, try base article
                            if (!matchingArticle && paragraph) {
                                matchingArticle = articleData.articles.find(art => {
                                    const artNum = art.article_number;
                                    return artNum.includes(article) || artNum.includes(`第 ${article} 條`);
                                });
                            }

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
            }, 150); // 150ms delay for better UX
        }
    }
});

// Clear current hovered law when mouse leaves
document.addEventListener('mouseout', (e) => {
    // Don't trigger mouseout logic when entering the popup
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#citeright-popover')) {
        return;
    }

    if (e.target.classList.contains('citeright-link')) {
        // Clear timeout if mouse leaves before delay completes
        clearTimeout(showTimeout);

        const lawId = getLawIdentifier(e.target);

        // Only clear if we're leaving the currently tracked law
        if (currentHoveredLaw === lawId) {
            currentHoveredLaw = null;
        }

        // Hide popup after short delay if not hovering popover
        hideTimeout = setTimeout(() => {
            if (!isPopoverHovered()) {
                popover.style.display = 'none';
                activePopupLaw = null;
            }
        }, 600);
    }
});

// Click blank area or X button to close popover
document.addEventListener('click', (e) => {
    if (isActivated && popover.style.display === 'block') {
        // Close if clicking X button
        if (e.target.classList.contains('citeright-close')) {
            popover.style.display = 'none';
            currentHoveredLaw = null;
            activePopupLaw = null;
            return;
        }

        // Close if clicking blank area (not on popover, legal links, or buttons)
        if (!e.target.closest('#citeright-popover') &&
            !e.target.classList.contains('citeright-link') &&
            !e.target.closest('.citeright-link')) {
            popover.style.display = 'none';
            currentHoveredLaw = null;
            activePopupLaw = null;
        }
    }
});

// Popover now only closes on blank click, not on mouse events

// Click to show popup with full database data
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('citeright-link')) {
        e.preventDefault();

        // Check if extension is globally enabled
        if (!isExtensionEnabled) {
            showActivationNotification('擴充功能已停用', '請在工具列圖示中啟用擴充功能', '#d73527');
            return;
        }

        const lawId = getLawIdentifier(e.target);

        // Only prevent if same law popup is currently open
        if (activePopupLaw === lawId && popover.style.display === 'block') {
            console.log('⛔ Click ignored - same law popup already open:', lawId);
            return;
        }

        // Set as active and display popup
        activePopupLaw = lawId;

        // Show popover with full database data
        await showPopoverForTargetWithData(e.target);
    }
});

// Enhanced helper function to show popover with full database data
async function showPopoverForTargetWithData(target) {
    console.log('🎣 Loading full database data for:', target.textContent);

    const lawId = getLawIdentifier(target);
    activePopupLaw = lawId;

    const rect = target.getBoundingClientRect();
    positionPopover(rect);

    popover.style.display = 'block';
    showPopoverLoader();

    const { legalType, caseType, lawName, article, paragraph, year, number } = target.dataset;

    try {
        if (legalType === 'law_article') {
            await loadLawArticleData(lawName, article, paragraph);
        } else if (caseType === '釋字') {
            await loadInterpretationData(number);
        } else {
            await loadCourtCaseData(year, caseType, number);
        }
    } catch (error) {
        showPopoverError(error);
    }
}


// Helper function to position popover
function positionPopover(rect) {
    const sidebar = document.getElementById('citeright-main-sidebar');
    const sidebarWidth = sidebar && sidebar.style.transform === 'translateX(0px)' ? sidebar.offsetWidth : 0;
    const effectiveViewportWidth = window.innerWidth - sidebarWidth;
    
    let left = rect.left + window.scrollX;
    let top = rect.top + window.scrollY - 12; // Position above the text by default
    
    const popoverWidth = 420;
    const popoverHeight = 350;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;
    
    // Adjust horizontal position to avoid sidebar and screen edges
    if (left + popoverWidth > scrollLeft + effectiveViewportWidth - 20) {
        left = Math.max(scrollLeft + 10, scrollLeft + effectiveViewportWidth - popoverWidth - 20);
    }
    if (left < scrollLeft + 10) {
        left = scrollLeft + 10;
    }
    
    // Check if there's enough space above for the popover
    if (top - scrollTop < popoverHeight + 20) {
        // Not enough space above, position below the text
        top = rect.bottom + window.scrollY + 8;
    }
    
    // Make sure it doesn't go below viewport
    if (top + popoverHeight > scrollTop + viewportHeight - 20) {
        top = Math.max(scrollTop + 10, scrollTop + viewportHeight - popoverHeight - 20);
    }
    
    // Ensure minimum distance from top
    if (top < scrollTop + 10) {
        top = scrollTop + 10;
    }
    
    // Use fixed positioning for better control and higher z-index
    popover.style.position = 'fixed';
    popover.style.left = Math.max(10, left - scrollLeft) + 'px';
    popover.style.top = Math.max(10, top - scrollTop) + 'px';
    popover.style.zIndex = '2147483647';
}

// Helper function to show popover loader
function showPopoverLoader() {
    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');
    loader.style.display = 'block';
    content.style.display = 'none';
}

// Helper function to show popover error
function showPopoverError(error) {
    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');
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

// Helper function to load law article data from database
async function loadLawArticleData(lawName, article, paragraph) {
    const apiUrl = `http://localhost:3000/api/laws/search?q=${encodeURIComponent(lawName)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');

    if (data.success && data.results.length > 0) {
        const law = data.results[0];
        const articleUrl = `http://localhost:3000/api/laws/${law.id}`;
        const articleResponse = await fetch(articleUrl);
        const articleData = await articleResponse.json();

        let matchingArticle = articleData.articles.find(art => {
            const artNum = art.article_number;
            // Try different matching patterns
            return artNum.includes(article) ||
                artNum.includes(`第 ${article} 條`) ||
                artNum.includes(`${article}-`) || // For paragraph format like "188-1"
                (paragraph && artNum.includes(`${article}${paragraph}`)); // For "188-1" format
        });

        // If paragraph specified but no exact match, try base article
        if (!matchingArticle && paragraph) {
            matchingArticle = articleData.articles.find(art => {
                const artNum = art.article_number;
                return artNum.includes(article) || artNum.includes(`第 ${article} 條`);
            });
        }

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

        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = generateLawArticleHTML(law, matchingArticle, lawName, article, paragraph);
    } else {
        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = generateNotFoundHTML('找不到相關法條', `法條名稱：${lawName}`);
    }
}

// Helper function to load interpretation data from database
async function loadInterpretationData(number) {
    const apiUrl = `http://localhost:3000/api/case?caseType=釋字&number=${number}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');

    if (data.success && data.data) {
        const interp = data.data;

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

        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = generateInterpretationHTML(interp, number);
    } else {
        loader.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = generateNotFoundHTML('找不到此號解釋', `釋字第${number}號`);
    }
}

// Helper function to load court case data (placeholder)
async function loadCourtCaseData(year, caseType, number) {
    const loader = popover.querySelector('.citeright-loader');
    const content = popover.querySelector('.citeright-content');

    loader.style.display = 'none';
    content.style.display = 'block';
    content.innerHTML = `
        <div style="color: #999; text-align: center; padding: 20px;">
            <div style="font-size: 24px;">🏦</div>
            <div style="margin-top: 8px;">法院判決查詢功能開發中</div>
            <div style="font-size: 12px; margin-top: 4px;">${year}年度${caseType}字第${number}號</div>
        </div>
    `;
}

// HTML generation functions
function generateLawArticleHTML(law, matchingArticle, lawName, article, paragraph) {
    return `
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
                    ${matchingArticle.article_content || '條文內容載入中...'}
                </div>
            </div>
        ` : generateNotFoundHTML('找不到對應條文內容', '')}
    `;
}

function generateInterpretationHTML(interp, number) {
    return `
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
                    ${interp.chinese.description}
                </div>
            </div>
        ` : ''}
    `;
}

function generateNotFoundHTML(title, subtitle) {
    return `
        <div style="color: #999; text-align: center; padding: 20px;">
            <div style="font-size: 24px;">🔍</div>
            <div style="margin-top: 8px;">${title}</div>
            ${subtitle ? `<div style="font-size: 12px; margin-top: 4px;">${subtitle}</div>` : ''}
        </div>
    `;
}

// Legacy function for backwards compatibility
async function showPopoverForTarget(target) {
    // Legacy function - redirect to new enhanced version
    return showPopoverForTargetWithData(target);
}

// Backup function for old implementation
async function showPopoverForTargetOld(target) {
    console.log('🎯 Showing popover for:', target.textContent);

    const rect = target.getBoundingClientRect();

    // Smart positioning close to underline
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8; // Close to underline

    // Keep within screen bounds - improved boundary detection
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;

    // Horizontal bounds check
    if (left + 450 > scrollLeft + viewportWidth) {
        left = Math.max(scrollLeft + 10, scrollLeft + viewportWidth - 460);
    }
    if (left < scrollLeft + 10) {
        left = scrollLeft + 10;
    }

    // Vertical bounds check
    if (top + 350 > scrollTop + viewportHeight) {
        top = rect.top + scrollTop - 360; // Show above if no space below
    }
    if (top < scrollTop + 10) {
        top = scrollTop + 10; // Don't go above viewport
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
            Object.entries(TAIWAN_LEGAL_PATTERNS).forEach(([k,p]) => {
                const m = testText.match(new RegExp(p.source, p.flags));
                console.log('Pattern test', k, m);
            });
        }
    }, 300);
}

// Listen for messages from background script and popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "activateCiteRight") {
            isActivated = true;
            console.log('⚖️ 透過右鍵選單啟用台灣法源探測器');
            showActivationNotification();
            updateActivationStatus();

            // If there's selected text, try to highlight it immediately
            if (message.selectedText) {
                console.log('📝 選取文字:', message.selectedText);
                highlightCitations();
            }

            // Set auto-deactivation timer
            clearTimeout(activationTimeout);
            activationTimeout = setTimeout(() => {
                isActivated = false;
                popover.style.display = 'none';
                console.log('⏰ 法源探測器已自動停用 (5分鐘無操作)');
                updateActivationStatus();
            }, 300000);

            sendResponse({ success: true });
        } else if (message.action === "deactivateCiteRight") {
            isActivated = false;
            popover.style.display = 'none';
            clearTimeout(activationTimeout);
            console.log('❌ 透過右鍵選單停用台灣法源探測器');
            updateActivationStatus();
            sendResponse({ success: true });
        } else if (message.action === "toggleExtension") {
            isExtensionEnabled = message.enabled;

            if (isExtensionEnabled) {
                console.log('🟢 CiteRight 擴充功能已透過彈出視窗啟用');
                showActivationNotification('擴充功能已啟用', '按 Ctrl 啟動懸停模式', '#52c41a');
            } else {
                console.log('🔴 CiteRight 擴充功能已透過彈出視窗停用');
                isActivated = false;
                popover.style.display = 'none';
                clearTimeout(activationTimeout);
                showActivationNotification('擴充功能已停用', '所有功能已關閉', '#d73527');
            }
            updateActivationStatus();
            sendResponse({ success: true });
        } else if (message.action === "openBookmarks") {
            console.log('📚 透過彈出視窗開啟書籤面板');
            showBookmarksPanel();
            sendResponse({ success: true });
        } else if (message.action === "getStatus") {
            sendResponse({
                activated: isActivated,
                bookmarkCount: bookmarkedLaws.length
            });
        }
    });
}

// Global extension enabled state (separate from activation) - default enabled
let isExtensionEnabled = true;

// Apply enabled state from background broadcast at startup
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['citeright_enabled'], res => {
        // Default to enabled if not set
        isExtensionEnabled = res.citeright_enabled !== undefined ? res.citeright_enabled : true;
        if (isExtensionEnabled) {
            console.log('🟢 CiteRight 擴充功能已啟用');
        } else {
            console.log('🔴 CiteRight 擴充功能已停用');
        }
        updateActivationStatus();
    });
}

// Initialize extension when content script loads
initializeExtension();

// Extend existing message handler for global enable broadcast
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'setEnabledState') {
            isExtensionEnabled = !!msg.enabled;
            if (!isExtensionEnabled) {
                isActivated = false;
                popover.style.display = 'none';
                clearTimeout(activationTimeout);
                showActivationNotification('擴充功能已停用', '所有功能已關閉', '#d73527');
            } else {
                showActivationNotification('擴充功能已啟用', '按 Ctrl 啟動懸停模式', '#52c41a');
            }
            updateActivationStatus();
        }
    });
}
