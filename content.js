// content.js - 法源探測器 (CiteRight)
// 專業版，整合官方司法院 API 後端

const TAIWAN_CASE_PATTERNS = {
    basic: /([0-9０-９]{2,3})\s*年度?\s*([\u4e00-\u9fa5]{1,6}?)\s*字\s*第\s*([0-9０-９]+)\s*號/g,
    constitutional: /([0-9０-９]{2,3})\s*年\s*憲判字\s*第\s*([0-9０-９]+)\s*號/g,
    interpretation: /釋字第\s*([0-9０-９]+)\s*號/g
};

function toHalfWidthDigits(str) {
    return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30));
}

function makeSpan(match, key, groups) {
    let year = '', caseType = '', number = '';
    if (key === 'basic') {
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
    }
    return `<span class="citeright-link" data-year="${year}" data-case-type="${caseType}" data-number="${number}">${match}</span>`;
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
        for (const [key, pattern] of Object.entries(TAIWAN_CASE_PATTERNS)) {
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
        console.warn('❌ 未檢測到案號標示。請檢查擴充套件是否已重新載入 / 或目前頁面無匹配格式');
    } else {
        console.log(`✅ highlightCitations completed. Found ${finalCount} links (added this run: ${created})`);
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
    popover.style.cssText = `position:fixed;z-index:2147483647;background:#fff;border:2px solid #007bff;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.3);width:450px;max-width:90vw;font-family:\"Microsoft JhengHei\",Arial,sans-serif;font-size:14px;color:#333;display:none;pointer-events:auto;`;
    popover.innerHTML = `
      <div class="citeright-header" style="padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #dee2e6;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0;cursor:move;user-select:none;">
        <span style="font-weight:600;color:#1890ff;font-size:16px;">📄 判決摘要</span>
        <button class="citeright-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;padding:4px;margin:0;width:24px;height:24px;">&times;</button>
      </div>
      <div class="citeright-loader" style="padding:20px;text-align:center;color:#666;background:white;">🔄 載入中...</div>
      <div class="citeright-content" style="padding:16px;max-height:300px;overflow-y:auto;display:none;background:white;border-radius:0 0 6px 6px;"></div>`;
    document.body.appendChild(popover);

    popover.querySelector('.citeright-close').addEventListener('click', e => { e.stopPropagation(); popover.style.display = 'none'; });

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

    document.addEventListener('keydown', e => { if (e.key === 'Escape') popover.style.display = 'none'; });
    return popover;
}

// Create popover
const popover = createPopoverElement();
let hideTimeout;

// Mouseover event for links
document.addEventListener('mouseover', async (e) => {
    if (e.target.classList.contains('citeright-link')) {
        console.log('🎯 Found citeright-link!', e.target.textContent);
        clearTimeout(hideTimeout);

        const target = e.target;
        const rect = target.getBoundingClientRect();

        // Smart positioning
        let left = rect.left + window.scrollX;
        let top = rect.top + window.scrollY - 350;

        if (left + 450 > window.innerWidth) {
            left = window.innerWidth - 460;
        }
        if (top < 10) {
            top = rect.bottom + window.scrollY + 10;
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
                ? `http://localhost:3002/api/case?caseType=${encodeURIComponent(caseType)}&number=${number}`
                : `http://localhost:3002/api/case?year=${year}&caseType=${encodeURIComponent(caseType)}&number=${number}`;

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
                    <div style="color: #555; background: #f8f9fa; padding: 12px; border-radius: 4px;">
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
});

// Mouseout event
document.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('citeright-link')) {
        hideTimeout = setTimeout(() => {
            popover.style.display = 'none';
        }, 300);
    }
});

// Popover hover events
popover.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
});

popover.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
        popover.style.display = 'none';
    }, 300);
});

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
        .citeright-link { background-color:#e6f7ff !important; border-bottom:1px dotted #91d5ff !important; cursor:pointer !important; transition:background-color .2s ease !important; padding:1px 2px !important; border-radius:2px !important; }
        .citeright-link:hover { background-color:#bae7ff !important; border-bottom:1px solid #40a9ff !important; }
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

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}
