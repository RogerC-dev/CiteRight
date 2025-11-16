// Auto-resize textarea
const messageInput = document.getElementById('messageInput');
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// Enable send button when there's text
messageInput.addEventListener('input', function () {
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = this.value.trim() === '';
});

// Send message on Enter (without Shift)
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// API configuration
const API_BASE = 'http://localhost:3000/api';
let currentConversationId = null;
let currentModel = 'gpt-3.5-turbo';

// Demo query counter
let demoQueriesUsed = 0;
const demoQueryLimit = 5;

// Send message function
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (message === '') return;

    // Check demo limit (can be removed when subscription is implemented)
    if (demoQueriesUsed >= demoQueryLimit) {
        alert('Demo limit reached! You\'ve used all 5 free queries. Please upgrade to Pro for unlimited access.');
        return;
    }

    demoQueriesUsed++;

    // Remove welcome message if exists
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.style.display = 'none';
    }

    // Add user message
    addMessage(message, 'user');

    // Clear input and disable send button
    input.value = '';
    input.style.height = 'auto';
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    // Update demo status
    updateDemoStatus();

    // Show loading indicator
    const loadingMessage = addMessage('思考中...', 'assistant', true);

    try {
        // Get selected model
        const activeModelCard = document.querySelector('.model-card.active');
        if (activeModelCard) {
            const modelName = activeModelCard.querySelector('.model-name').textContent.toLowerCase();
            if (modelName.includes('gpt-4')) {
                currentModel = 'gpt-4';
            } else if (modelName.includes('gemini')) {
                currentModel = 'gemini';
            } else if (modelName.includes('claude')) {
                currentModel = 'claude';
            } else {
                currentModel = 'gpt-3.5-turbo';
            }
        }

        // Call AI API
        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                conversationId: currentConversationId,
                model: currentModel
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Update conversation ID
            currentConversationId = data.data.conversationId;

            // Remove loading message and add AI response
            loadingMessage.remove();
            addMessage(data.data.message, 'assistant', false, data.data.sources);
        } else {
            throw new Error(data.error || 'Failed to get AI response');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        loadingMessage.remove();
        addMessage(`抱歉，發生錯誤：${error.message}。請稍後再試。`, 'assistant');
    } finally {
        sendBtn.disabled = false;
    }
}

function updateDemoStatus() {
    const remaining = demoQueryLimit - demoQueriesUsed;
    if (remaining <= 0) {
        const input = document.getElementById('messageInput');
        input.placeholder = 'Demo limit reached. Upgrade to Pro for unlimited queries.';
        input.disabled = true;
        document.getElementById('sendBtn').disabled = true;
    } else {
        const input = document.getElementById('messageInput');
        input.placeholder = `Demo: ${remaining} queries remaining. Ask about Taiwan law...`;
    }
}

// Send prompt from quick actions
function sendPrompt(prompt) {
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

// Add message to chat
function addMessage(text, sender, isLoading = false, sources = []) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    if (isLoading) {
        messageDiv.classList.add('loading');
    }

    let header = '';
    if (sender === 'assistant') {
        const modelName = document.getElementById('currentModel')?.textContent || 'GPT-4 + Legal DB';
        header = `<div class="message-header">🤖 CiteRight AI (${modelName})</div>`;
    }

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        sourcesHtml = `
            <div class="cited-sources">
                ${sources.map(source => `<span class="cited-source">${source}</span>`).join('')}
            </div>
        `;
    } else if (sender === 'assistant' && text.includes('民法')) {
        // Auto-detect citations in text (fallback)
        sourcesHtml = `
            <div class="cited-sources">
                <span class="cited-source">📚 相關法條</span>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-content">
            ${header}
            <div class="message-text">${isLoading ? '<div class="loading-spinner"></div>' : text.replace(/\n/g, '<br>')}</div>
            ${sourcesHtml}
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv;
}

// Generate AI response (mock)
function generateAIResponse(message) {
    const responses = {
        '分析民法第965條的繼承權規定': '根據民法第965條規定，繼承人有數人時，在分割遺產前，各繼承人對於遺產全部為公同共有。這意味著所有繼承人共同擁有遺產的所有權，任何一位繼承人都不能單獨處分遺產。\\n\\n此條文確立了「公同共有」的原則，保護所有繼承人的權益，確保遺產分配的公平性。實務上常見的爭議包括...',
        '搜尋最近的智慧財產權判決': '為您找到最近的智慧財產權相關判決：\\n\\n1. 最高法院112年度台上字第2345號判決 - 商標侵權案\\n2. 智慧財產法院111年度民專訴字第89號 - 專利無效案\\n3. 台北地方法院112年度智字第156號 - 著作權爭議\\n\\n需要詳細分析哪個判決嗎？'
    };

    return responses[message] || `我理解您的問題關於「${message}」。讓我為您查詢相關的法律資料庫...\\n\\n根據台灣現行法律，這個問題涉及多個層面。首先...`;
}

// Model selection
document.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', function () {
        document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
        this.classList.add('active');

        const modelName = this.querySelector('.model-name').textContent;
        document.getElementById('currentModel').textContent = modelName + ' + Legal DB';

        // Update current model
        const modelNameLower = modelName.toLowerCase();
        if (modelNameLower.includes('gpt-4')) {
            currentModel = 'gpt-4';
        } else if (modelNameLower.includes('gemini')) {
            currentModel = 'gemini';
        } else if (modelNameLower.includes('claude')) {
            currentModel = 'claude';
        } else {
            currentModel = 'gpt-3.5-turbo';
        }
    });
});

// Load chat history on page load
async function loadChatHistory() {
    if (!currentConversationId) return;

    try {
        const response = await fetch(`${API_BASE}/ai/history?conversationId=${currentConversationId}`);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            // Clear current messages (except welcome)
            const chatMessages = document.getElementById('chatMessages');
            const welcomeMsg = chatMessages.querySelector('.welcome-message');
            chatMessages.innerHTML = '';
            if (welcomeMsg) {
                chatMessages.appendChild(welcomeMsg);
            }

            // Add history messages
            data.data.forEach(msg => {
                addMessage(msg.content, msg.role);
            });
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Load history when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Try to load last conversation
    loadChatHistory();
});

// Settings modal
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeSettings();
    }
});

// PDF functionality
let uploadedPdfs = [];

// Load PDF API service
async function loadPdfApiService() {
    try {
        // In a real extension, you'd import this properly
        // For now, we'll implement basic functionality inline
        return {
            uploadAndProcessPdf: async function (file) {
                // Simulate API call
                const formData = new FormData();
                formData.append('pdf', file);

                const response = await fetch('http://localhost:3000/api/pdf/process', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('PDF processing failed');
                }

                return await response.json();
            },
            processUrlPdf: async function (url) {
                const response = await fetch('http://localhost:3000/api/pdf/process-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                if (!response.ok) {
                    throw new Error('PDF URL processing failed');
                }

                return await response.json();
            }
        };
    } catch (error) {
        console.error('Failed to load PDF API service:', error);
        return null;
    }
}

// PDF Upload Functions
function triggerPdfUpload() {
    document.getElementById('pdfUploadArea').classList.add('active');
}

function closePdfUpload() {
    document.getElementById('pdfUploadArea').classList.remove('active');
    resetPdfUpload();
}

function showUrlPdfDialog() {
    document.getElementById('pdfUrlArea').classList.add('active');
}

function closePdfUrl() {
    document.getElementById('pdfUrlArea').classList.remove('active');
    resetPdfUrl();
}

function resetPdfUpload() {
    document.getElementById('pdfFileInput').value = '';
    document.getElementById('pdfProgress').style.display = 'none';
    document.getElementById('pdfProgressFill').style.width = '0%';
}

function resetPdfUrl() {
    document.getElementById('pdfUrlInput').value = '';
    document.getElementById('pdfUrlProgress').style.display = 'none';
    document.getElementById('pdfUrlProgressFill').style.width = '0%';
}

// PDF file input handler
document.getElementById('pdfFileInput').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (file) {
        await processPdfFile(file);
    }
});

// Drag and drop for PDF upload
const uploadZone = document.getElementById('pdfUploadZone');

uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
});

uploadZone.addEventListener('drop', async function (e) {
    e.preventDefault();
    this.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        await processPdfFile(files[0]);
    } else {
        alert('Please drop a PDF file.');
    }
});

// Process PDF file
async function processPdfFile(file) {
    try {
        // Validate file
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            alert('File size must be less than 50MB');
            return;
        }

        // Show progress
        document.getElementById('pdfProgress').style.display = 'block';
        updatePdfProgress(10, 'Uploading PDF...');

        const pdfService = await loadPdfApiService();
        if (!pdfService) {
            throw new Error('PDF service unavailable');
        }

        updatePdfProgress(30, 'Processing document...');

        // Process PDF
        const result = await pdfService.uploadAndProcessPdf(file);

        updatePdfProgress(80, 'Extracting text...');

        // Add to documents list
        const pdfDoc = {
            id: Date.now().toString(),
            fileName: file.name,
            text: result.text || result.markdown || '',
            metadata: result.metadata || {},
            uploadedAt: new Date().toISOString(),
            type: 'upload'
        };

        uploadedPdfs.push(pdfDoc);
        addPdfToSources(pdfDoc);

        updatePdfProgress(100, 'Complete!');

        // Auto-insert context into chat
        setTimeout(() => {
            addPdfContextMessage(pdfDoc);
            closePdfUpload();
        }, 1000);

    } catch (error) {
        console.error('PDF processing failed:', error);
        alert(`PDF processing failed: ${error.message}`);
        resetPdfUpload();
    }
}

// Process PDF URL
async function processPdfUrl() {
    const url = document.getElementById('pdfUrlInput').value.trim();

    if (!url) {
        alert('Please enter a PDF URL');
        return;
    }

    if (!url.match(/^https?:\/\/.+\.pdf$/i) && !url.includes('pdf')) {
        alert('Please enter a valid PDF URL');
        return;
    }

    try {
        // Show progress
        document.getElementById('pdfUrlProgress').style.display = 'block';
        updatePdfUrlProgress(10, 'Downloading PDF...');

        const pdfService = await loadPdfApiService();
        if (!pdfService) {
            throw new Error('PDF service unavailable');
        }

        updatePdfUrlProgress(40, 'Processing document...');

        const result = await pdfService.processUrlPdf(url);

        updatePdfUrlProgress(80, 'Extracting text...');

        const pdfDoc = {
            id: Date.now().toString(),
            fileName: result.fileName || url.split('/').pop() || 'document.pdf',
            text: result.text || result.markdown || '',
            metadata: result.metadata || {},
            sourceUrl: url,
            uploadedAt: new Date().toISOString(),
            type: 'url'
        };

        uploadedPdfs.push(pdfDoc);
        addPdfToSources(pdfDoc);

        updatePdfUrlProgress(100, 'Complete!');

        setTimeout(() => {
            addPdfContextMessage(pdfDoc);
            closePdfUrl();
        }, 1000);

    } catch (error) {
        console.error('PDF URL processing failed:', error);
        alert(`PDF processing failed: ${error.message}`);
        resetPdfUrl();
    }
}

// Update progress indicators
function updatePdfProgress(percent, text) {
    document.getElementById('pdfProgressFill').style.width = percent + '%';
    document.getElementById('pdfProgressText').textContent = text;
}

function updatePdfUrlProgress(percent, text) {
    document.getElementById('pdfUrlProgressFill').style.width = percent + '%';
    document.getElementById('pdfUrlProgressText').textContent = text;
}

// Add PDF to sources sidebar
function addPdfToSources(pdfDoc) {
    const sourcesSection = document.querySelector('.sources-section');

    // Create PDF document card
    const pdfCard = document.createElement('div');
    pdfCard.className = 'pdf-document-card';
    pdfCard.innerHTML = `
        <div class="pdf-document-header" data-pdf-id="${pdfDoc.id}">
            <div class="pdf-document-info">
                <div class="pdf-document-icon">📄</div>
                <div class="pdf-document-details">
                    <div class="pdf-document-name">${pdfDoc.fileName}</div>
                    <div class="pdf-document-meta">${formatFileSize(pdfDoc.text?.length)} • ${formatDate(pdfDoc.uploadedAt)}</div>
                </div>
            </div>
            <div class="pdf-document-actions">
                <button class="pdf-action-btn pdf-use-btn" title="Use in chat" data-pdf-id="${pdfDoc.id}">💬</button>
                <button class="pdf-action-btn pdf-remove-btn" title="Remove" data-pdf-id="${pdfDoc.id}">🗑️</button>
            </div>
        </div>
        <div class="pdf-document-content" id="pdfContent-${pdfDoc.id}">
            ${pdfDoc.text.substring(0, 500)}${pdfDoc.text.length > 500 ? '...' : ''}
        </div>
    `;

    // Insert after the "SOURCES" title
    const sourcesTitle = sourcesSection.querySelector('.section-title');
    sourcesTitle.insertAdjacentElement('afterend', pdfCard);

    // Add event listeners for the new card
    const header = pdfCard.querySelector('.pdf-document-header');
    header.addEventListener('click', () => togglePdfContent(pdfDoc.id));

    const useBtn = pdfCard.querySelector('.pdf-use-btn');
    useBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertPdfIntoChat(pdfDoc.id);
    });

    const removeBtn = pdfCard.querySelector('.pdf-remove-btn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePdf(pdfDoc.id);
    });
}

// Toggle PDF content visibility
function togglePdfContent(pdfId) {
    const content = document.getElementById(`pdfContent-${pdfId}`);
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
}

// Insert PDF context into chat
function insertPdfIntoChat(pdfId) {
    const pdf = uploadedPdfs.find(p => p.id === pdfId);
    if (pdf) {
        const input = document.getElementById('messageInput');
        input.value = `請分析這份 PDF 文件的內容：「${pdf.fileName}」\\n\\n您可以詢問其中的法律要點、關鍵條文，或要求我進行特定分析。`;
        input.focus();
    }
}

// Remove PDF from list
function removePdf(pdfId) {
    if (confirm('確定要移除這個 PDF 文件嗎？')) {
        uploadedPdfs = uploadedPdfs.filter(p => p.id !== pdfId);
        document.querySelector(`#pdfContent-${pdfId}`).closest('.pdf-document-card').remove();
    }
}

// Add PDF context message to chat
function addPdfContextMessage(pdfDoc) {
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.style.display = 'none';
    }

    addMessage(`📄 已處理 PDF 文件：「${pdfDoc.fileName}」\\n\\n✅ 文件已加載完成，您現在可以詢問相關內容`, 'assistant');

    // Scroll to show the message
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Utility functions
function formatFileSize(length) {
    if (!length) return '0 B';
    const kb = length / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
}

// Close modals when clicking outside
document.getElementById('pdfUploadArea').addEventListener('click', function (e) {
    if (e.target === this) closePdfUpload();
});

document.getElementById('pdfUrlArea').addEventListener('click', function (e) {
    if (e.target === this) closePdfUrl();
});

// Initialize and add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initialize
    document.getElementById('sendBtn').disabled = true;

    // Add event listeners for PDF buttons
    document.getElementById('pdfUploadBtn').addEventListener('click', triggerPdfUpload);
    document.getElementById('urlPdfBtn').addEventListener('click', showUrlPdfDialog);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);

    // Add event listeners for modal buttons
    document.getElementById('closePdfUploadBtn').addEventListener('click', closePdfUpload);
    document.getElementById('closePdfUrlBtn').addEventListener('click', closePdfUrl);
    document.getElementById('processPdfUrlBtn').addEventListener('click', processPdfUrl);

    // Add event listeners for settings
    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('upgradeBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);

    // Add event listener for PDF upload zone
    document.getElementById('pdfUploadZone').addEventListener('click', function () {
        document.getElementById('pdfFileInput').click();
    });

    // Add event listeners for quick action cards
    document.querySelectorAll('.quick-action-card').forEach(card => {
        card.addEventListener('click', function () {
            const text = this.getAttribute('data-prompt');
            if (text) {
                sendPrompt(text);
            }
        });
    });
});