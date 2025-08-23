// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetchCaseSummary') {
    const { year, caseType, number } = message.payload;
    
    // Construct URL for backend API
    const backendURL = `http://localhost:3000/api/case?year=${year}&caseType=${encodeURIComponent(caseType)}&number=${number}`;
    
    // Fetch case summary from backend
    fetch(backendURL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Send response back to content script
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'caseSummaryResponse',
          data: data
        });
      })
      .catch(error => {
        console.error('Error fetching case summary:', error);
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'caseSummaryResponse',
          error: error.message
        });
      });
    
    return true; // Keep the message channel open for async response
  }
});

// Optional: Inject content script on tab updates (if needed)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(error => {
      // Ignore errors for pages where content scripts can't be injected
      console.log('Content script injection failed:', error);
    });
  }
});