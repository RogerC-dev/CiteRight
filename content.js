// content.js - 法源探測器 (CiteRight)
// 專業版，整合官方司法院 API 後端

const TAIWAN_CASE_PATTERNS = {
    basic: /(\d{2,3})\s*年度?\s*([\u4e00-\u9fa5]+?)\s*字\s*第\s*(\d+)\s*號/g,
    constitutional: /(\d{2,3})\s*年\s*憲判字\s*第\s*(\d+)\s*號/g,
    interpretation: /釋字第(\d+)號/g
};

function highlightCitations() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
        let nodeContent = node.nodeValue;
        const parent = node.parentNode;
        if (!parent || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') {
            return;
        }

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        // Combine all regex matches and sort them by index
        const allMatches = [];
        for (const key in TAIWAN_CASE_PATTERNS) {
            for (const match of nodeContent.matchAll(TAIWAN_CASE_PATTERNS[key])) {
                match.type = key;
                allMatches.push(match);
            }
        }
        allMatches.sort((a, b) => a.index - b.index);

        allMatches.forEach(match => {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(nodeContent.substring(lastIndex, match.index)));
            }

            const span = document.createElement('span');
            span.className = 'citeright-link';
            span.textContent = match[0];

            if (match.type === 'basic') {
                span.dataset.year = match[1];
                span.dataset.caseType = match[2];
                span.dataset.number = match[3];
            } else if (match.type === 'constitutional') {
                span.dataset.year = match[1];
                span.dataset.caseType = '憲判';
                span.dataset.number = match[2];
            } else if (match.type === 'interpretation') {
                span.dataset.year = '';
                span.dataset.caseType = '釋字';
                span.dataset.number = match[1];
            }

            fragment.appendChild(span);
            lastIndex = match.index + match[0].length;
        });

        if (lastIndex < nodeContent.length) {
            fragment.appendChild(document.createTextNode(nodeContent.substring(lastIndex)));
        }

        if (fragment.childNodes.length > 1) { // Only replace if matches were found
            parent.replaceChild(fragment, node);
        }
    });
}

function createPopoverElement() {
    if (document.getElementById('citeright-popover')) return document.getElementById('citeright-popover');

    const popover = document.createElement('div');
    popover.id = 'citeright-popover';
    popover.innerHTML = `
        <div class="citeright-header">
            <span class="citeright-title">判決摘要</span>
            <button class="citeright-close">&times;</button>
        </div>
        <div class="citeright-loader">載入中...</div>
        <div class="citeright-content"></div>
    `;
    document.body.appendChild(popover);

    popover.querySelector('.citeright-close').addEventListener('click', () => {
        popover.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popover.style.display = 'none';
        }
    });

    return popover;
}

const popover = createPopoverElement();
let hideTimeout;

document.body.addEventListener('mouseover', async (e) => {
    if (e.target.classList.contains('citeright-link')) {
        clearTimeout(hideTimeout);
        const target = e.target;

        // Position popover intelligently
        const rect = target.getBoundingClientRect();
        const popoverWidth = 400;
        const popoverHeight = 300;

        let left = rect.left + window.scrollX + 15;
        let top = rect.bottom + window.scrollY + 5;

        // Adjust if popover would go off-screen
        if (left + popoverWidth > window.innerWidth) {
            left = rect.right + window.scrollX - popoverWidth - 15;
        }
        if (top + popoverHeight > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - popoverHeight - 5;
        }

        popover.style.display = 'block';
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.querySelector('.citeright-loader').style.display = 'block';
        popover.querySelector('.citeright-content').style.display = 'none';

        const { year, caseType, number } = target.dataset;

        if (!caseType || !number) {
            popover.querySelector('.citeright-loader').style.display = 'none';
            popover.querySelector('.citeright-content').style.display = 'block';
            popover.querySelector('.citeright-content').innerHTML = `<div class="citeright-error">此案號格式暫不支援查詢</div>`;
            return;
        }

        try {
            const url = `http://localhost:3002/api/case?year=${encodeURIComponent(year || '')}&caseType=${encodeURIComponent(caseType)}&number=${encodeURIComponent(number)}`;
            const response = await fetch(url);
            const result = await response.json();

            popover.querySelector('.citeright-loader').style.display = 'none';
            const contentDiv = popover.querySelector('.citeright-content');
            contentDiv.style.display = 'block';

            if (result.error) {
                contentDiv.innerHTML = `<div class="citeright-error">${result.error}</div>`;
                if (result.suggestion) {
                    contentDiv.innerHTML += `<div class="citeright-suggestion">${result.suggestion}</div>`;
                }
            } else if (result.success && result.data) {
                const data = result.data;
                const fullContent = data.JFULLCONTENT || '無內容';
                const truncatedContent = fullContent.length > 400 ?
                    fullContent.substring(0, 400) + '...' : fullContent;

                contentDiv.innerHTML = `
                    <div class="info"><strong>案由：</strong> ${data.JTITLE || 'N/A'}</div>
                    <div class="info"><strong>案號：</strong> ${data.JYEAR || year}年度${data.JCASE || caseType}字第${data.JNO || number}號</div>
                    <div class="info"><strong>法院：</strong> ${data.JCOURT || 'N/A'}</div>
                    <div class="info"><strong>審理級別：</strong> ${data.JLEVEL || 'N/A'}</div>
                    <hr>
                    <div class="summary">${truncatedContent}</div>
                    <div class="source-info">📊 資料來源：官方司法院API</div>
                `;
            } else {
                contentDiv.innerHTML = `<div class="citeright-error">無法取得案件資料</div>`;
            }
        } catch (error) {
            popover.querySelector('.citeright-loader').style.display = 'none';
            const contentDiv = popover.querySelector('.citeright-content');
            contentDiv.style.display = 'block';

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                contentDiv.innerHTML = `
                    <div class="citeright-error">無法連線至後端服務</div>
                    <div class="citeright-suggestion">請確認伺服器是否正在運行：<br><code>npm start</code></div>
                `;
            } else {
                contentDiv.innerHTML = `<div class="citeright-error">查詢失敗：${error.message}</div>`;
            }
        }
    }
});

document.body.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('citeright-link')) {
        hideTimeout = setTimeout(() => {
            popover.style.display = 'none';
        }, 300);
    }
});

popover.addEventListener('mouseover', () => {
    clearTimeout(hideTimeout);
});

popover.addEventListener('mouseout', () => {
    hideTimeout = setTimeout(() => {
        popover.style.display = 'none';
    }, 300);
});

// Initialize the extension
highlightCitations();

// Add a small indicator that the extension is active
console.log('🔍 法源探測器 (CiteRight) 已啟動 - 使用官方司法院API');
