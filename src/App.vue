<template>
  <div id="citeright-app">
    <!-- 法律彈出視窗組件 -->
    <LegalPopover
      v-if="extensionStore.isExtensionEnabled"
      :show="popoverStore.isVisible"
      :trigger-element="popoverStore.triggerElement"
      :loading="popoverStore.isLoading"
      :data="popoverStore.currentData"
      @close="popoverStore.hide"
      @bookmark="bookmarkStore.addBookmark"
      @expand="handleExpand"
    />
    
    <!-- 主側邊欄組件 -->
    <MainSidebar 
      v-if="extensionStore.isExtensionEnabled && sidebarStore.isOpen"
      :width="sidebarStore.width"
      :current-tab="sidebarStore.currentTab"
      @close="sidebarStore.close"
      @resize="sidebarStore.setWidth"
      @tab-change="sidebarStore.setCurrentTab"
      @dictionary-result="handleDictionaryResult"
      @law-content="handleLawContent"
    />
    
    <!-- 浮動按鈕 - 開啟側邊欄 -->
    <FloatingButton v-if="extensionStore.isExtensionEnabled" />
    
    <!-- 通知組件 -->
    <NotificationManager />
    
    <!-- 高亮處理組件（無 UI，純邏輯） -->
    <CitationHighlighter 
      v-if="extensionStore.isExtensionEnabled"
      :enabled="extensionStore.isActivated"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import LegalPopover from './components/ui/LegalPopover.vue'
import MainSidebar from './components/ui/MainSidebar.vue'
import FloatingButton from './components/ui/FloatingButton.vue'
import NotificationManager from './components/ui/NotificationManager.vue'
import CitationHighlighter from './components/legal/CitationHighlighter.vue'
import { useExtensionStore } from './stores/extension'
import { usePopoverStore } from './stores/popover'
import { useSidebarStore } from './stores/sidebar'
import { useBookmarkStore } from './stores/bookmark'
import { useFlashcardStore } from './stores/flashcard'
import { formatLawArticle } from './services/textFormatter.js'

// 使用 stores
const extensionStore = useExtensionStore()
const popoverStore = usePopoverStore()
const sidebarStore = useSidebarStore()
const bookmarkStore = useBookmarkStore()
const flashcardStore = useFlashcardStore()

// Dictionary event handlers
async function handleDictionaryResult(result) {
  console.log('📚 App - Dictionary result:', result)
  
  if (result.lawName) {
    // First, load a placeholder while fetching full content
    popoverStore.loadContent('法律', {
      id: `law_${Date.now()}`,
      title: result.lawName,
      type: '法律',
      lawName: result.lawName,
      article: result.article || '',
      content: `<div class="loading-content">
        <div class="loading-spinner"></div>
        <p>正在載入${result.lawName}的詳細內容...</p>
        <div class="preview-text">${result.preview || ''}</div>
      </div>`,
      officialUrl: result.officialUrl || (result.source === '臺灣法規資料庫' 
        ? `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${encodeURIComponent(result.lawName)}` 
        : ''),
      dateAdded: new Date().toISOString(),
      source: result.source
    })
    
    // Try to fetch full law content
    try {
      const { useDictionaryStore } = await import('./stores/dictionary')
      const dictionaryStore = useDictionaryStore()
      
      const fullContent = await dictionaryStore.fetchLawContent(result.lawName)
      
      if (fullContent) {
        // Update with full content
        popoverStore.loadContent('法律', {
          id: `law_${Date.now()}`,
          title: fullContent.title || result.lawName,
          type: '法律',
          lawName: result.lawName,
          article: result.article || '',
          content: formatLawContent(fullContent),
          officialUrl: fullContent.officialUrl || result.officialUrl,
          dateAdded: new Date().toISOString(),
          source: result.source
        })
        
        console.log('✅ 成功載入完整法規內容:', result.lawName)
      }
    } catch (error) {
      console.warn('⚠️ 無法載入完整法規內容，使用預覽內容:', error.message)
      // Content remains as preview only
    }
  }
}

function handleLawContent(lawData) {
  console.log('📖 App - Law content:', lawData)
  
  // Load the law content into tool tab
  if (lawData.content) {
    popoverStore.loadContent('法律', {
      id: `law_content_${Date.now()}`,
      title: lawData.lawName,
      type: '法律',
      content: formatLawContent(lawData.content),
      officialUrl: lawData.content.officialUrl || '',
      dateAdded: new Date().toISOString()
    })
  }
}

function handleExpand() {
  console.log('📖 展開到側邊欄')
  
  // 確保側邊欄開啟並切換到工具分頁
  sidebarStore.open()
  sidebarStore.setCurrentTab('tool')
  
  // 如果彈出視窗有內容，確保它在工具分頁中顯示
  if (popoverStore.currentData) {
    console.log('📝 轉移內容到工具分頁:', popoverStore.currentData.title || '未知內容')
    // 內容已經在 popoverStore.currentData 中，ToolContent 會自動顯示
  }
  
  // 關閉彈出視窗
  popoverStore.hide()
}

function formatLawContent(lawContent) {
  // If content is already a string (formatted), return it as-is
  if (typeof lawContent === 'string') {
    return lawContent
  }
  
  // If content doesn't have chapters structure, return basic info
  if (!lawContent || !lawContent.chapters || !Array.isArray(lawContent.chapters)) {
    return lawContent?.title || '無法載入法規內容'
  }
  
  let html = `<div class="law-content-formatted">
    <div class="law-header">
      <h2 class="law-title">${lawContent.title || '法規'}</h2>
      <div class="law-meta">
        ${lawContent.lastAmended ? `<span class="meta-item">📅 最後修正：${new Date(lawContent.lastAmended).toLocaleDateString('zh-TW')}</span>` : ''}
        <span class="meta-item">📊 狀態：${lawContent.status === 'active' ? '現行有效' : '已廢止'}</span>
        ${lawContent.totalArticles ? `<span class="meta-item">📝 總計：${lawContent.totalArticles} 條</span>` : ''}
      </div>
    </div>`
  
  lawContent.chapters.forEach((chapter, chapterIndex) => {
    if (chapter && chapter.name) {
      html += `<div class="law-chapter" data-chapter="${chapterIndex}">
        <h3 class="chapter-title">${chapter.name}</h3>
        <div class="chapter-articles">`
      
      if (chapter.articles && Array.isArray(chapter.articles)) {
        chapter.articles.forEach((article, articleIndex) => {
          if (article && (article.content || article.number)) {
            // 使用文字格式化工具處理條文內容，創建段落分明的排版
            const formattedContent = article.content ? formatLawArticle(article.content) : ''
            html += `<div class="law-article" data-article="${articleIndex}">
              ${article.number ? `<div class="article-number">第${article.number}條${article.title ? ` ${article.title}` : ''}</div>` : ''}
              ${formattedContent ? `<div class="article-content">${formattedContent}</div>` : ''}
            </div>`
          }
        })
      }
      
      html += `</div></div>`
    }
  })
  
  html += `</div>`
  return html
}

onMounted(() => {
  // 初始化擴充功能
  extensionStore.initialize()
  bookmarkStore.loadBookmarks()
  flashcardStore.loadDecks()

  // 監聽書籤載入事件
  window.addEventListener('citeright:load-bookmark', handleBookmarkLoad)

  // 監聽分頁切換事件
  window.addEventListener('citeright:switch-tab', handleTabSwitch)
})

function handleBookmarkLoad(event) {
  const bookmark = event.detail
  console.log('📚 App - Loading bookmark:', bookmark.title, 'Type:', bookmark.type)

  // 載入書籤內容到工具分頁
  if (bookmark) {
    // 傳遞完整的書籤數據，特別是釋字數據中的重要字段
    const bookmarkData = {
      ...bookmark, // 保留所有原始數據
      id: bookmark.id,
      title: bookmark.title,
      type: bookmark.type || '法律',
      content: bookmark.content || bookmark.fullContent || '無內容可顯示',
      fullContent: bookmark.fullContent || bookmark.content || '無內容可顯示',
      number: bookmark.number || '',
      officialUrl: bookmark.officialUrl || '',
      dateAdded: bookmark.dateAdded || new Date().toISOString(),
      source: bookmark.source || '書籤',
      // 確保釋字相關數據被傳遞
      issue: bookmark.issue || (bookmark.raw?.issue),
      description: bookmark.description || (bookmark.raw?.description),
      reasoning: bookmark.reasoning || (bookmark.raw?.reasoning),
      chinese: bookmark.chinese || bookmark.raw?.chinese,
      lawName: bookmark.lawName || bookmark.raw?.lawName
    }

    popoverStore.loadContent(bookmark.type || '法律', bookmarkData)
  }
}

function handleTabSwitch(event) {
  const { tab } = event.detail
  console.log('🔄 App - Switching to tab:', tab)
  
  // 確保側邊欄開啟並切換到指定分頁
  sidebarStore.open()
  sidebarStore.setCurrentTab(tab)
}

onUnmounted(() => {
  // 清理資源
  extensionStore.cleanup()
  
  // 清理事件監聽器
  window.removeEventListener('citeright:load-bookmark', handleBookmarkLoad)
  window.removeEventListener('citeright:switch-tab', handleTabSwitch)
})
</script>

<style scoped>
#citeright-app {
  /* 確保不影響頁面佈局 */
  position: relative;
  z-index: 2147483647;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  color: #333;
}

/* 全域樣式 */
:global(.citeright-link) {
  background: linear-gradient(120deg, #e6f7ff 0%, #f0f9ff 100%) !important;
  border-bottom: 2px dotted #1890ff !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  padding: 2px 4px !important;
  border-radius: 4px !important;
  position: relative !important;
  font-weight: 500 !important;
  box-shadow: 0 1px 3px rgba(24, 144, 255, 0.1) !important;
}

:global(.citeright-link:hover) {
  background: linear-gradient(120deg, #bae7ff 0%, #e6f7ff 100%) !important;
  border-bottom: 2px solid #1890ff !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2) !important;
}

:global(.citeright-link[data-case-type="法條"]) {
  border-bottom-color: #52c41a !important;
  background: linear-gradient(120deg, #f6ffed 0%, #f0f9ff 100%) !important;
}

:global(.citeright-link[data-case-type="釋字"]) {
  border-bottom-color: #722ed1 !important;
  background: linear-gradient(120deg, #f9f0ff 0%, #f0f9ff 100%) !important;
}

/* 法規內容格式化樣式 */
:global(.law-content-formatted) {
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  line-height: 1.8;
  color: #333;
}

:global(.law-header) {
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
  border-radius: 8px;
  border-left: 4px solid #1890ff;
}

:global(.law-title) {
  margin: 0 0 12px 0;
  color: #1890ff;
  font-size: 20px;
  font-weight: 600;
}

:global(.law-meta) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #666;
}

:global(.meta-item) {
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 8px;
  border-radius: 4px;
}

:global(.law-chapter) {
  margin-bottom: 24px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: white;
}

:global(.chapter-title) {
  margin: 0;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  border-radius: 8px 8px 0 0;
  color: #1890ff;
  font-size: 16px;
  font-weight: 600;
}

:global(.chapter-articles) {
  padding: 16px;
}

:global(.law-article) {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

:global(.law-article:last-child) {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

:global(.article-number) {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
  font-size: 15px;
}

:global(.article-content) {
  color: #555;
  line-height: 1.8;
  padding-left: 12px;
}

/* 載入狀態樣式 */
:global(.loading-content) {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

:global(.loading-spinner) {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

:global(.preview-text) {
  margin-top: 20px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
  border-left: 4px solid #1890ff;
  text-align: left;
  color: #555;
  line-height: 1.6;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>