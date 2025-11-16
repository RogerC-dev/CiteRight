// This file contains the improved bookmark functionality fixes
// To be integrated into content.js

// Improved notification function with better animations and modern design
function showActivationNotification(title, subtitle, bgColor = '#52c41a', icon = '⚖️') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.citeright-notification');
    existingNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = 'citeright-notification';
    notification.style.cssText = `
        position: fixed; 
        top: 24px; 
        right: 24px; 
        z-index: 2147483648;
        background: linear-gradient(135deg, ${bgColor}, ${adjustBrightness(bgColor, -20)});
        color: white; 
        text-shadow: 0 1px 3px rgba(0,0,0,0.2);
        padding: 16px 20px; 
        border-radius: 12px; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px; 
        font-weight: 500; 
        box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        min-width: 280px;
        max-width: 400px;
        animation: notificationSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                   notificationFadeOut 0.3s ease-in 2.2s forwards;
        transform: translateX(100%);
        opacity: 0;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="
                background: rgba(255,255,255,0.2); 
                border-radius: 50%; 
                width: 32px; 
                height: 32px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 16px;
                flex-shrink: 0;
            ">${icon}</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; font-size: 15px;">
                    ${title}
                </div>
                <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">
                    ${subtitle}
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: rgba(255,255,255,0.2); 
                border: none; 
                color: white; 
                border-radius: 50%; 
                width: 24px; 
                height: 24px; 
                cursor: pointer; 
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: all 0.2s;
                flex-shrink: 0;
            " onmouseover="this.style.opacity='1'; this.style.background='rgba(255,255,255,0.3)'"
               onmouseout="this.style.opacity='0.8'; this.style.background='rgba(255,255,255,0.2)'">×</button>
        </div>
    `;

    // Add CSS animations if not already present
    if (!document.getElementById('citeright-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'citeright-notification-styles';
        style.textContent = `
            @keyframes notificationSlideIn {
                0% { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
                100% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
            }
            
            @keyframes notificationFadeOut {
                0% { 
                    transform: translateX(0); 
                    opacity: 1; 
                }
                100% { 
                    transform: translateX(100%); 
                    opacity: 0; 
                }
            }
            
            .citeright-notification:hover {
                animation-play-state: paused !important;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after animation completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 2500);
}

// Helper function to adjust color brightness
function adjustBrightness(color, percent) {
    // Simple color adjustment - can be enhanced for more color formats
    if (color.startsWith('#')) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    return color;
}

// Improved bookmark panel styling
const improvedBookmarkPanelHTML = `
<div style="padding: 20px;">
    ${bookmarkedLaws.length === 0 ? `
        <div style="text-align: center; color: #8c8c8c; padding: 60px 20px;">
            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📚</div>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">尚未儲存任何書籤</div>
            <div style="font-size: 13px; line-height: 1.5;">在法條詳情中點擊「📚 加入書籤」<br>來儲存您感興趣的法律條文</div>
        </div>
    ` : `
        <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 18px; color: #1890ff; display: flex; align-items: center; gap: 10px;">
                    📚 我的法律書籤
                </h3>
                <span style="background: linear-gradient(135deg, #e6f7ff, #bae7ff); color: #1890ff; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">
                    ${bookmarkedLaws.length} 個書籤
                </span>
            </div>
            <div style="font-size: 13px; color: #8c8c8c;">點擊查看詳情，或使用 × 移除不需要的書籤</div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${bookmarkedLaws.map((bookmark, index) => `
                <div class="bookmark-item" data-bookmark-id="${bookmark.id}" style="
                    background: white; 
                    border-radius: 16px; 
                    padding: 20px; 
                    border: 1px solid #f0f0f0; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02); 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    position: relative; 
                    overflow: hidden;
                    background-image: linear-gradient(135deg, #ffffff 0%, #fafbff 100%);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="
                            font-weight: 600; 
                            color: #1890ff; 
                            font-size: 16px; 
                            line-height: 1.4; 
                            flex: 1; 
                            margin-right: 12px;
                            background: linear-gradient(135deg, #1890ff, #40a9ff);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">${bookmark.title}</div>
                        <button class="delete-bookmark" style="
                            background: rgba(255, 77, 79, 0.1); 
                            border: none; 
                            color: #ff4d4f; 
                            border-radius: 50%; 
                            padding: 6px; 
                            cursor: pointer; 
                            font-size: 16px; 
                            width: 28px; 
                            height: 28px; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
                            opacity: 0.6; 
                            flex-shrink: 0;
                        " title="移除這個書籤" 
                        onmouseover="this.style.opacity='1'; this.style.background='rgba(255, 77, 79, 0.15)'; this.style.transform='scale(1.1)'"
                        onmouseout="this.style.opacity='0.6'; this.style.background='rgba(255, 77, 79, 0.1)'; this.style.transform='scale(1)'">×</button>
                    </div>
                    
                    <div style="
                        font-size: 12px; 
                        color: #8c8c8c; 
                        margin-bottom: 12px; 
                        display: flex; 
                        align-items: center; 
                        gap: 8px;
                        background: rgba(24, 144, 255, 0.05);
                        padding: 6px 10px;
                        border-radius: 8px;
                        border-left: 3px solid #1890ff;
                    ">
                        <span style="font-weight: 500; color: #1890ff;">${bookmark.type}</span>
                        <span style="width: 4px; height: 4px; background: #d9d9d9; border-radius: 50%;"></span>
                        <span>儲存於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}</span>
                    </div>
                    
                    <div style="
                        font-size: 13px; 
                        color: #595959; 
                        line-height: 1.6; 
                        margin-bottom: 16px;
                        background: rgba(0,0,0,0.02);
                        padding: 12px;
                        border-radius: 8px;
                        border-left: 2px solid #f0f0f0;
                    ">
                        ${bookmark.content ? 
                            (bookmark.content.length > 150 ? 
                                bookmark.content.substring(0, 150) + '...' : 
                                bookmark.content) : 
                            '無內容摘要'}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <button class="view-bookmark" style="
                            padding: 8px 16px; 
                            font-size: 13px; 
                            background: linear-gradient(135deg, #f0f9ff, #e6f7ff); 
                            color: #1890ff; 
                            border: 1px solid #91d5ff; 
                            border-radius: 8px; 
                            cursor: pointer; 
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(24, 144, 255, 0.15)'"
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            📖 查看完整內容
                        </button>
                        <div style="font-size: 11px; color: #bfbfbf;">
                            #${index + 1}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `}
</div>
`;

// Improved delete bookmark function with animation
function deleteBookmarkWithAnimation(bookmarkElement, bookmarkId) {
    // Add exit animation
    bookmarkElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    bookmarkElement.style.transform = 'translateX(100%)';
    bookmarkElement.style.opacity = '0';
    
    setTimeout(() => {
        // Remove from array and localStorage
        bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
        localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
        
        // Remove element
        bookmarkElement.remove();
        
        // Update counters
        updateBookmarkCounters();
        
        // Show success notification
        showActivationNotification(
            '書籤已移除', 
            '已成功從您的收藏中移除該法條', 
            '#ff4d4f',
            '🗑️'
        );
        
        // Refresh bookmark list if empty
        if (bookmarkedLaws.length === 0) {
            loadBookmarksContent();
        }
    }, 300);
}

// Helper function to update bookmark counters
function updateBookmarkCounters() {
    const counters = document.querySelectorAll('[data-bookmark-counter]');
    counters.forEach(counter => {
        counter.textContent = bookmarkedLaws.length;
    });
    
    const descriptions = document.querySelectorAll('[data-bookmark-description]');
    descriptions.forEach(desc => {
        desc.textContent = `已儲存 ${bookmarkedLaws.length} 個書籤`;
    });
}