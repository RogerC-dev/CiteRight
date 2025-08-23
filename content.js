// Taiwan citation regex pattern
const taiwanCitationRegex = /(\d{2,3})\s*年度\s*([^\s]+)\s*字第\s*(\d+)\s*號/g;

// Create popover HTML (only once)
function createPopoverHTML() {
  if (document.getElementById('precedent-popover')) return;
  
  const popoverHTML = `
    <div id="precedent-popover" style="display: none;">
      <div class="popover-header">
        <span class="popover-title">判決摘要</span>
        <button class="close-button">&times;</button>
      </div>
      <div class="loader">載入中...</div>
      <div class="popover-content" style="display: none;"></div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', popoverHTML);
  
  // Add close button functionality
  document.querySelector('#precedent-popover .close-button').addEventListener('click', () => {
    document.getElementById('precedent-popover').style.display = 'none';
  });
}

// Find and replace citations with links
function findAndReplaceCitations() {
  const baseURL = 'https://law.judicial.gov.tw/FJUD/data.aspx';
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  
  // Collect all text nodes first
  while (node = walker.nextNode()) {
    if (node.nodeValue.trim() && taiwanCitationRegex.test(node.nodeValue)) {
      textNodes.push(node);
    }
  }
  
  // Process each text node
  textNodes.forEach(textNode => {
    const text = textNode.nodeValue;
    const matches = [...text.matchAll(taiwanCitationRegex)];
    
    if (matches.length === 0) return;
    
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    
    matches.forEach(match => {
      const [fullMatch, year, caseType, number] = match;
      const startIndex = match.index;
      
      // Add text before match
      if (startIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, startIndex)));
      }
      
      // Create link
      const link = document.createElement('a');
      link.href = `${baseURL}?q=jrec;js=0;jyear=${year};jcase=${encodeURIComponent(caseType)};jno=${number}`;
      link.textContent = fullMatch;
      link.className = 'precedent-link';
      link.target = '_blank';
      link.setAttribute('data-year', year);
      link.setAttribute('data-case-type', caseType);
      link.setAttribute('data-number', number);
      
      fragment.appendChild(link);
      
      lastIndex = startIndex + fullMatch.length;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace the text node
    textNode.parentNode.replaceChild(fragment, textNode);
  });
}

// Event delegation for link clicks
document.body.addEventListener('click', (event) => {
  if (event.target.classList.contains('precedent-link')) {
    event.preventDefault();
    
    const year = event.target.getAttribute('data-year');
    const caseType = event.target.getAttribute('data-case-type');
    const number = event.target.getAttribute('data-number');
    
    // Show popover at click position
    const popover = document.getElementById('precedent-popover');
    popover.style.display = 'block';
    popover.style.left = event.pageX + 10 + 'px';
    popover.style.top = event.pageY + 10 + 'px';
    
    // Show loading spinner
    popover.querySelector('.loader').style.display = 'block';
    popover.querySelector('.popover-content').style.display = 'none';
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'fetchCaseSummary',
      payload: { year, caseType, number }
    });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'caseSummaryResponse') {
    const popover = document.getElementById('precedent-popover');
    const loader = popover.querySelector('.loader');
    const content = popover.querySelector('.popover-content');
    
    loader.style.display = 'none';
    content.style.display = 'block';
    
    if (message.error) {
      content.innerHTML = `<p class="error">載入失敗: ${message.error}</p>`;
    } else {
      const { summary, court, date } = message.data;
      content.innerHTML = `
        <div class="case-info">
          <p><strong>審理法院:</strong> ${court || '未知'}</p>
          <p><strong>判決日期:</strong> ${date || '未知'}</p>
          <div class="summary">
            <strong>摘要:</strong>
            <p>${summary || '無摘要資料'}</p>
          </div>
        </div>
      `;
    }
  }
});

// Self-invoking function to initialize
(function() {
  createPopoverHTML();
  findAndReplaceCitations();
})();