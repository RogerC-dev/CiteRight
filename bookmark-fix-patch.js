// bookmark-fix-patch.js - Fixes for CiteRight bookmark functionality
// This patches the existing content.js to fix the remove button and styling issues

// Enhanced bookmark button creation with better styling and functionality
function createBookmarkActions(bookmark, isCurrentBookmarked = false) {
    const buttonBaseStyle = `
        padding: 8px 16px; 
        border: 1px solid; 
        border-radius: 8px; 
        cursor: pointer; 
        font-size: 13px; 
        font-weight: 500; 
        transition: all 0.2s ease; 
        display: inline-flex; 
        align-items: center; 
        gap: 6px;
        text-decoration: none;
        outline: none;
    `;

    const addButtonStyle = `${buttonBaseStyle}
        background: linear-gradient(135deg, #f6ffed, #d9f7be); 
        color: #52c41a; 
        border-color: #b7eb8f;
    `;

    const removeButtonStyle = `${buttonBaseStyle}
        background: linear-gradient(135deg, #fff2f0, #ffd6cc); 
        color: #ff4d4f; 
        border-color: #ffccc7;
    `;

    const officialButtonStyle = `${buttonBaseStyle}
        background: linear-gradient(135deg, #f0f9ff, #d6e4ff); 
        color: #1890ff; 
        border-color: #91d5ff;
    `;

    const hoverStyleAdd = `
        this.style.background='linear-gradient(135deg, #d9f7be, #b7eb8f)';
        this.style.transform='translateY(-2px)';
        this.style.boxShadow='0 4px 12px rgba(82, 196, 26, 0.2)';
    `;

    const hoverStyleRemove = `
        this.style.background='linear-gradient(135deg, #ffd6cc, #ffadd2)';
        this.style.transform='translateY(-2px)';
        this.style.boxShadow='0 4px 12px rgba(255, 77, 79, 0.2)';
    `;

    const hoverStyleOfficial = `
        this.style.background='linear-gradient(135deg, #d6e4ff, #adc6ff)';
        this.style.transform='translateY(-2px)';
        this.style.boxShadow='0 4px 12px rgba(24, 144, 255, 0.2)';
    `;

    const resetStyle = `
        this.style.transform='translateY(0)';
        this.style.boxShadow='none';
    `;

    const addButton = isCurrentBookmarked ? '' : `
        <button 
            id="add-to-bookmarks-btn" 
            style="${addButtonStyle}"
            onmouseover="${hoverStyleAdd}"
            onmouseout="this.style.background='linear-gradient(135deg, #f6ffed, #d9f7be)'; ${resetStyle}"
            title="將此法條加入書籤收藏"
        >
            📚 加入書籤
        </button>
    `;

    const removeButton = isCurrentBookmarked ? `
        <button 
            id="remove-from-bookmarks-btn" 
            style="${removeButtonStyle}"
            onmouseover="${hoverStyleRemove}"
            onmouseout="this.style.background='linear-gradient(135deg, #fff2f0, #ffd6cc)'; ${resetStyle}"
            title="從書籤中移除此法條"
        >
            🗑️ 移除書籤
        </button>
    ` : '';

    const officialButton = bookmark.officialUrl ? `
        <button 
            id="official-link-btn" 
            style="${officialButtonStyle}"
            onmouseover="${hoverStyleOfficial}"
            onmouseout="this.style.background='linear-gradient(135deg, #f0f9ff, #d6e4ff)'; ${resetStyle}"
            title="前往官方法條頁面"
        >
            🔗 官方頁面
        </button>
    ` : '';

    return `
        <div style="
            margin: 16px 0; 
            padding: 16px; 
            background: linear-gradient(135deg, #fafbff, #f0f9ff); 
            border-radius: 12px; 
            border: 1px solid #e6f7ff;
            display: flex; 
            gap: 12px; 
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
        ">
            ${addButton}${removeButton}${officialButton}
        </div>
    `;
}

// Enhanced bookmark title display (fixes repetitive issue)
function createBookmarkTitle(bookmark) {
    // Extract clean title without repetitive information
    let cleanTitle = bookmark.title || '';
    
    // Remove duplicated information
    if (bookmark.type && bookmark.number) {
        const duplicatePattern = new RegExp(`${bookmark.type}.*?第?${bookmark.number}[條號]?`, 'gi');
        cleanTitle = cleanTitle.replace(duplicatePattern, '').trim();
        
        // If title becomes empty after cleaning, use original
        if (!cleanTitle) {
            cleanTitle = bookmark.title;
        }
    }
    
    // Create proper title format
    const typeText = bookmark.type || '';
    const numberText = bookmark.number ? `第${bookmark.number}${typeText === '釋字' ? '號' : '條'}` : '';
    const displayTitle = cleanTitle || `${typeText}${numberText}`;
    
    return `
        <div style="
            margin-bottom: 20px; 
            padding: 20px; 
            background: linear-gradient(135deg, #1890ff, #40a9ff); 
            border-radius: 12px; 
            color: white;
            text-align: center;
            box-shadow: 0 4px 16px rgba(24, 144, 255, 0.3);
        ">
            <h2 style="
                margin: 0 0 8px 0; 
                font-size: 22px; 
                font-weight: 600;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">${displayTitle}</h2>
            <div style="
                font-size: 14px; 
                opacity: 0.9;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
            ">
                ${typeText ? `<span style="
                    background: rgba(255,255,255,0.2); 
                    padding: 4px 8px; 
                    border-radius: 6px;
                ">${typeText}</span>` : ''}
                ${numberText ? `<span style="
                    background: rgba(255,255,255,0.2); 
                    padding: 4px 8px; 
                    border-radius: 6px;
                ">${numberText}</span>` : ''}
                ${bookmark.dateAdded ? `<span style="
                    background: rgba(255,255,255,0.15); 
                    padding: 4px 8px; 
                    border-radius: 6px;
                ">收藏於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}</span>` : ''}
            </div>
        </div>
    `;
}

// Enhanced bookmark removal function with proper feedback
function removeBookmarkWithFeedback(bookmarkId, callback) {
    console.log('🗑️ Attempting to remove bookmark:', bookmarkId);
    
    // Find the bookmark
    const bookmark = bookmarkedLaws.find(b => b.id === bookmarkId);
    if (!bookmark) {
        console.warn('❌ Bookmark not found:', bookmarkId);
        showActivationNotification('移除失敗', '找不到指定的書籤', '#ff4d4f', '❌');
        return false;
    }

    // Remove from array
    const originalCount = bookmarkedLaws.length;
    bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
    
    if (bookmarkedLaws.length === originalCount) {
        console.warn('❌ Failed to remove bookmark from array');
        showActivationNotification('移除失敗', '書籤移除操作失敗', '#ff4d4f', '❌');
        return false;
    }
    
    // Save to localStorage
    try {
        localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
        console.log('✅ Bookmark removed successfully:', bookmark.title);
        
        // Show success notification
        showActivationNotification(
            '書籤已移除', 
            `已成功移除「${bookmark.title}」`,
            '#ff4d4f', 
            '🗑️'
        );
        
        // Execute callback if provided
        if (typeof callback === 'function') {
            callback();
        }
        
        // Refresh bookmark content
        loadBookmarksContent();
        
        return true;
    } catch (error) {
        console.error('❌ Failed to save to localStorage:', error);
        showActivationNotification('保存失敗', '無法保存書籤變更', '#ff4d4f', '❌');
        return false;
    }
}

// Enhanced bookmark content renderer with all fixes applied
function renderEnhancedBookmarkContent(bookmark) {
    console.log('🎨 Rendering enhanced bookmark content for:', bookmark.title);
    
    try {
        // Check if currently bookmarked
        const isCurrentBookmarked = bookmarkedLaws.some(b => 
            b.id === bookmark.id || 
            (b.type === bookmark.type && b.number === bookmark.number)
        );
        
        // Create clean content
        const displayContent = bookmark.fullContent || bookmark.content || '無可用內容';
        const cleanContent = displayContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
        
        // Build HTML with enhanced components
        const titleSection = createBookmarkTitle(bookmark);
        const actionsSection = createBookmarkActions(bookmark, isCurrentBookmarked);
        
        const html = `
            ${titleSection}
            
            <div id="tool-main-content" style="
                background: white; 
                padding: 24px; 
                border-radius: 12px; 
                border: 1px solid #e8e8e8; 
                color: #333; 
                line-height: 1.8; 
                font-size: 15px; 
                min-height: 200px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            ">
                ${cleanContent}
            </div>
            
            ${actionsSection}
        `;
        
        // Update the tool content
        const toolContentDiv = document.getElementById('tool-content');
        if (toolContentDiv) {
            toolContentDiv.innerHTML = html;
            
            // Wire up event listeners with enhanced functionality
            const addBtn = document.getElementById('add-to-bookmarks-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    if (currentLawData) {
                        addToBookmarks();
                        // Re-render to show remove button
                        setTimeout(() => renderEnhancedBookmarkContent(bookmark), 500);
                    }
                });
            }
            
            const removeBtn = document.getElementById('remove-from-bookmarks-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    removeBookmarkWithFeedback(bookmark.id, () => {
                        // Show success state
                        toolContentDiv.innerHTML = `
                            <div style="
                                text-align: center; 
                                color: #52c41a; 
                                padding: 60px 20px;
                                background: linear-gradient(135deg, #f6ffed, #d9f7be);
                                border-radius: 12px;
                                border: 1px solid #b7eb8f;
                            ">
                                <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
                                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">書籤已成功移除</div>
                                <div style="font-size: 14px; color: #389e0d;">您可以點擊其他法條連結來查看內容</div>
                            </div>
                        `;
                    });
                });
            }
            
            const officialBtn = document.getElementById('official-link-btn');
            if (officialBtn && bookmark.officialUrl) {
                officialBtn.addEventListener('click', () => {
                    window.open(bookmark.officialUrl, '_blank');
                    showActivationNotification('正在開啟', '前往官方法條頁面', '#1890ff', '🔗');
                });
            }
            
            // Apply highlighting to content
            setTimeout(() => {
                const contentDiv = document.getElementById('tool-main-content');
                if (contentDiv && typeof highlightCitationsInElement === 'function') {
                    highlightCitationsInElement(contentDiv);
                }
            }, 100);
        }
        
        console.log('✅ Enhanced bookmark content rendered successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to render enhanced bookmark content:', error);
        showActivationNotification('載入失敗', '無法顯示法條內容', '#ff4d4f', '❌');
        return false;
    }
}

// Apply patches to existing functions
if (typeof window !== 'undefined') {
    // Override the existing loadBookmarkInToolTab function
    const originalLoadBookmarkInToolTab = window.loadBookmarkInToolTab;
    window.loadBookmarkInToolTab = function(bookmark) {
        console.log('📚 Using enhanced bookmark renderer for:', bookmark.title);
        
        // Switch to tool tab first
        const toolTabBtn = document.getElementById('tab-tool');
        const bookmarkTabBtn = document.getElementById('tab-bookmarks');
        const toolContent = document.getElementById('tab-content-tool');
        const bookmarkContent = document.getElementById('tab-content-bookmarks');
        
        if (toolTabBtn && bookmarkTabBtn && toolContent && bookmarkContent) {
            // Update tab buttons
            toolTabBtn.classList.add('active');
            bookmarkTabBtn.classList.remove('active');
            
            // Update tab content visibility
            toolContent.style.display = 'block';
            bookmarkContent.style.display = 'none';
        }
        
        // Set as current law data
        currentLawData = { ...bookmark };
        
        // Use enhanced renderer
        return renderEnhancedBookmarkContent(bookmark);
    };
    
    console.log('✅ Bookmark functionality patches applied successfully');
    
    // Add enhanced CSS for better button styling
    if (!document.getElementById('bookmark-enhancement-styles')) {
        const style = document.createElement('style');
        style.id = 'bookmark-enhancement-styles';
        style.textContent = `
            /* Enhanced bookmark button styling */
            #add-to-bookmarks-btn, #remove-from-bookmarks-btn, #official-link-btn {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                text-shadow: none !important;
                border-width: 1px !important;
                border-style: solid !important;
            }
            
            /* Hover state improvements */
            #add-to-bookmarks-btn:active {
                transform: translateY(0) scale(0.98) !important;
            }
            
            #remove-from-bookmarks-btn:active {
                transform: translateY(0) scale(0.98) !important;
            }
            
            #official-link-btn:active {
                transform: translateY(0) scale(0.98) !important;
            }
            
            /* Focus states for accessibility */
            #add-to-bookmarks-btn:focus,
            #remove-from-bookmarks-btn:focus,
            #official-link-btn:focus {
                outline: 2px solid rgba(24, 144, 255, 0.4) !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);
    }
}

console.log('📚 Bookmark enhancement patches loaded successfully');
console.log('✅ Fixed issues:');
console.log('  - Remove button functionality');
console.log('  - Button styling and hover effects');
console.log('  - Repetitive title display');
console.log('  - Button placement and sizing');

export { 
    createBookmarkActions,
    createBookmarkTitle, 
    removeBookmarkWithFeedback,
    renderEnhancedBookmarkContent 
};