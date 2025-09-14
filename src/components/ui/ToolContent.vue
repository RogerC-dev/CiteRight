<template>
  <div id="tool-content" class="tool-content">
    <div v-if="!hasCurrentData" class="empty-state">
      <div class="empty-icon">🔧</div>
      <div class="empty-title">請點擊法律條文來查看詳細資訊</div>
      <div class="empty-subtitle">按 Ctrl 啟動懸停模式</div>
    </div>
    
    <div v-else class="content-loaded">
      <!-- 標題區域 -->
      <div class="content-header">
        <h3 class="content-title">{{ displayData.title }}</h3>
        <div class="content-meta">
          📝 {{ displayData.type }}
          <span v-if="displayData.number">
            · 第{{ displayData.number }}{{ displayData.type === '釋字' ? '號' : '條' }}
          </span>
          <span v-if="displayData.dateAdded">
            · {{ formatDate(displayData.dateAdded) }}
          </span>
        </div>
      </div>

      <!-- 頂部操作按鈕區域 -->
      <div class="top-actions">
        <button
          class="action-btn bookmark-btn top-bookmark-btn"
          @click="handleBookmark"
          :disabled="isBookmarking"
        >
          📚 {{ isAlreadyBookmarked ? '已收藏' : '加入書籤' }}
        </button>

        <button
          v-if="hasEnglishContent"
          class="action-btn translate-btn"
          @click="toggleTranslation"
        >
          {{ showEnglish ? '🇨🇳 中文' : '🇬🇧 English' }}
        </button>
      </div>
      
      <!-- 主要內容區域 -->
      <div id="tool-main-content" class="main-content" v-html="cleanContent"></div>
      
      <!-- 操作按鈕區域 -->
      <div class="action-area">
        <div class="action-buttons">
          <button
            class="action-btn bookmark-btn"
            @click="handleBookmark"
            :disabled="isBookmarking"
          >
            📚 {{ isAlreadyBookmarked ? '已收藏' : '加入書籤' }}
          </button>
          
          <button
            v-if="displayData.officialUrl"
            class="action-btn link-btn"
            @click="openOfficialLink"
          >
            🔗 官方頁面
          </button>
          
          <button
            class="action-btn share-btn"
            @click="shareContent"
          >
            📤 分享
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useBookmarkStore } from '../../stores/bookmark.js'
import { usePopoverStore } from '../../stores/popover.js'

const bookmarkStore = useBookmarkStore()
const popoverStore = usePopoverStore()

// 狀態
const isBookmarking = ref(false)
const showEnglish = ref(false) // 控制是否顯示英文內容
// Use popover store's currentData directly
const currentData = computed(() => popoverStore.currentData)

// 計算屬性
const hasCurrentData = computed(() => {
  return currentData.value !== null
})

const displayData = computed(() => {
  if (!currentData.value) return {
    title: '未命名項目',
    type: '法律資訊',
    number: '',
    dateAdded: new Date().toISOString(),
    officialUrl: '',
    content: '無內容可顯示'
  }
  console.log(currentData.value, '顯示數據');

  // 安全地合併數據，避免 undefined 覆蓋預設值
  const safeData = {
    title: currentData.value.title || '未命名項目',
    type: currentData.value.type || '法律資訊',
    number: currentData.value.number || '',
    dateAdded: currentData.value.dateAdded || new Date().toISOString(),
    officialUrl: currentData.value.officialUrl || '',
    content: currentData.value.content || '無內容可顯示'
  }

  // 只添加有值的額外屬性
  Object.keys(currentData.value).forEach(key => {
    if (currentData.value[key] !== undefined && currentData.value[key] !== null && !(key in safeData)) {
      safeData[key] = currentData.value[key]
    }
  })

  return safeData
})

const cleanContent = computed(() => {
  if (!displayData.value.content || displayData.value.content === '無內容可顯示') {
    const element = document.querySelector("div.citeright-content")
    return element ? element.innerHTML : '無內容可顯示'
  }

  // 清理和處理內容
  let content = displayData.value.content

  // 如果是釋字類型，根據翻譯狀態處理內容
  if (displayData.value.type === 'interpretation' && currentData.value) {
    content = formatInterpretationContent(currentData.value, showEnglish.value)
  }

  // 移除 script 標籤
  content = content.replace(/<script[^>]*>.*?<\/script>/gi, '')

  // 確保內容安全
  content = content.replace(/<iframe[^>]*>/gi, '')
  content = content.replace(/<object[^>]*>/gi, '')
  content = content.replace(/<embed[^>]*>/gi, '')

  // 移除已存在的高亮標記，防止重複處理
  content = content.replace(/<span class="citeright-link"[^>]*>(.*?)<\/span>/gi, '$1')

  // 清理重複的字符（如第第，條條）
  content = content.replace(/第第/g, '第')
  content = content.replace(/條條/g, '條')
  content = content.replace(/號號/g, '號')
  content = content.replace(/項項/g, '項')
  content = content.replace(/款款/g, '款')
  content = content.replace(/目目/g, '目')

  return content
})

const isAlreadyBookmarked = computed(() => {
  if (!currentData.value) return false

  return bookmarkStore.bookmarks.some(bookmark =>
    bookmark.id === currentData.value.id ||
    (bookmark.type === currentData.value.type && bookmark.number === currentData.value.number)
  )
})

const hasEnglishContent = computed(() => {
  if (!currentData.value) return false
  return !!(currentData.value.english?.issue || currentData.value.english?.description || currentData.value.english?.reasoning)
})

/**
 * 載入數據到工具分頁
 */
function loadData(data) {
  console.log('📝 載入內容到工具分頁:', data?.title)

  if (!data) {
    currentData.value = null
    return
  }

  // 正規化數據
  currentData.value = {
    ...data,
    content: data.fullContent || data.content,
    fullContent: data.fullContent || data.content
  }

  // 正規化釋字類型
  if (data.caseType === '釋字' || data.type === '釋字') {
    currentData.value.type = 'interpretation'
    if (!currentData.value.id || /^law_/.test(currentData.value.id)) {
      currentData.value.id = `interpretation_${data.number || Date.now()}`
    }
    if (!currentData.value.title || /臺灣法規資料|法規資料/i.test(currentData.value.title)) {
      currentData.value.title = data.number ? `釋字第${data.number}號` : (currentData.value.title || '釋字')
    }
  }

  // 應用高亮處理到新內容
  nextTick(() => {
    const contentDiv = document.querySelector('#tool-main-content')
    if (contentDiv && window.citerightHighlightElement) {
      window.citerightHighlightElement(contentDiv)
    }
  })
}

/**
 * 處理書籤操作
 */
async function handleBookmark() {
  if (!currentData.value || isBookmarking.value) return

  isBookmarking.value = true

  try {
    if (isAlreadyBookmarked.value) {
      // 移除書籤
      const success = bookmarkStore.removeBookmark(currentData.value.id)
      if (success) {
        window.dispatchEvent(new CustomEvent('citeright:bookmark-removed', {
          detail: { title: currentData.value.title }
        }))
      }
    } else {
      // 加入書籤
      const success = bookmarkStore.addBookmark(currentData.value)
      if (success) {
        window.dispatchEvent(new CustomEvent('citeright:bookmark-added', {
          detail: { title: currentData.value.title }
        }))
      } else {
        window.dispatchEvent(new CustomEvent('citeright:bookmark-exists', {
          detail: { title: currentData.value.title }
        }))
      }
    }
  } catch (error) {
    console.error('書籤操作失敗:', error)
    window.dispatchEvent(new CustomEvent('citeright:error', {
      detail: {
        title: '書籤操作失敗',
        subtitle: error.message
      }
    }))
  } finally {
    isBookmarking.value = false
  }
}

/**
 * 開啟官方連結
 */
function openOfficialLink() {
  if (displayData.value.officialUrl) {
    window.open(displayData.value.officialUrl, '_blank')
  }
}

/**
 * 分享內容
 */
function shareContent() {
  if (!currentData.value) return

  const shareData = {
    title: displayData.value.title,
    text: `${displayData.value.title} - 來自 CiteRight 台灣法源探測器`,
    url: displayData.value.officialUrl || window.location.href
  }

  if (navigator.share) {
    navigator.share(shareData).catch(console.error)
  } else {
    // 備用方案：複製到剪貼簿
    const textToShare = `${shareData.title}\n${shareData.text}\n${shareData.url}`
    navigator.clipboard.writeText(textToShare).then(() => {
      window.dispatchEvent(new CustomEvent('citeright:notification', {
        detail: {
          title: '已複製到剪貼簿',
          subtitle: '可以分享給其他人了',
          type: 'success'
        }
      }))
    }).catch(console.error)
  }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '未知日期'

  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-TW')
  } catch {
    return '未知日期'
  }
}

/**
 * 切換翻譯顯示
 */
function toggleTranslation() {
  showEnglish.value = !showEnglish.value
}

/**
 * 格式化釋字內容（中/英文切換）
 */
function formatInterpretationContent(data, showEnglishContent = false) {
  if (!data) return '無內容可顯示'

  const sections = []

  if (showEnglishContent && data.english) {
    // 顯示英文內容
    if (data.english.issue) {
      sections.push(`<div class="interpretation-section english-section"><h4>Issue:</h4><p>${data.english.issue}</p></div>`)
    }
    if (data.english.description) {
      sections.push(`<div class="interpretation-section english-section"><h4>Description:</h4><p>${data.english.description}</p></div>`)
    }
    if (data.english.reasoning) {
      sections.push(`<div class="interpretation-section english-section"><h4>Reasoning:</h4><p>${data.english.reasoning}</p></div>`)
    }
  } else {
    // 顯示中文內容（預設）
    const issue = data.chinese?.issue || data.issue || ''
    const description = data.chinese?.description || data.description || ''
    const reasoning = data.chinese?.reasoning || data.reasoning || ''

    if (issue) {
      sections.push(`<div class="interpretation-section highlight-section"><h4>解釋爭點：</h4><p>${issue}</p></div>`)
    }
    if (description) {
      sections.push(`<div class="interpretation-section"><h4>解釋文：</h4><p>${description}</p></div>`)
    }
    if (reasoning) {
      sections.push(`<div class="interpretation-section"><h4>理由書：</h4><p>${reasoning}</p></div>`)
    }
  }

  return sections.length > 0 ? sections.join('') : '無法取得解釋內容'
}

/**
 * 清空內容
 */
function clearContent() {
  currentData.value = null
}

// 監聽 popover 當前數據變化
watch(() => popoverStore.currentData, (newData) => {
  if (newData) {
    loadData(newData)
  }
}, { immediate: true })

// 暴露方法給父組件
defineExpose({
  loadData,
  clearContent,
  currentData
})
</script>

<style scoped>
.tool-content {
  min-height: 100%;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 12px;
}

.content-loaded {
  animation: fadeIn 0.3s ease-out;
}

.content-header {
  margin-bottom: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
  border-radius: 8px;
  border-left: 4px solid #1890ff;
}

.content-title {
  margin: 0 0 8px 0;
  color: #1890ff;
  font-size: 18px;
  font-weight: 600;
}

.content-meta {
  font-size: 13px;
  color: #666;
}

.main-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  color: #333;
  line-height: 1.8;
  font-size: 15px;
  min-height: 200px;
  margin-bottom: 20px;
}

.action-area {
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  background: white;
}

.bookmark-btn {
  border-color: #52c41a;
  color: #52c41a;
}

.bookmark-btn:hover:not(:disabled) {
  background: #f6ffed;
}

.bookmark-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.link-btn {
  border-color: #1890ff;
  color: #1890ff;
}

.link-btn:hover {
  background: #f0f9ff;
}

.share-btn {
  border-color: #722ed1;
  color: #722ed1;
}

.share-btn:hover {
  background: #f9f0ff;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 內容區域樣式 */
:deep(.main-content) {
  /* 確保法條高亮正常顯示 */
}

:deep(.main-content .citeright-link) {
  /* 繼承全域高亮樣式 */
}

/* 解釋內容區塊樣式 */
:deep(.interpretation-section) {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border-left: 4px solid #722ed1;
}

:deep(.interpretation-section h4) {
  margin: 0 0 12px 0;
  color: #722ed1;
  font-size: 16px;
  font-weight: 600;
}

:deep(.interpretation-section p) {
  margin: 0;
  line-height: 1.8;
  color: #333;
}

/* 法律內容區塊樣式 */
:deep(.law-header) {
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
  border-radius: 8px;
  border-left: 4px solid #1890ff;
}

:deep(.law-header h3) {
  margin: 0 0 8px 0;
  color: #1890ff;
  font-size: 18px;
  font-weight: 600;
}

:deep(.last-amended) {
  margin: 0;
  font-size: 12px;
  color: #666;
}

:deep(.law-article) {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border-left: 4px solid #52c41a;
}

:deep(.article-number) {
  font-weight: 600;
  color: #52c41a;
  margin-bottom: 8px;
  font-size: 14px;
}

:deep(.article-caption) {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 12px;
  font-size: 15px;
}

:deep(.article-content) {
  line-height: 1.8;
  color: #333;
}

:deep(.error-message) {
  padding: 16px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  color: #cf1322;
}

:deep(.error-message ul) {
  margin: 12px 0 0 16px;
}

:deep(.error-message li) {
  margin-bottom: 4px;
}

/* 頂部操作按鈕 */
.top-actions {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.top-bookmark-btn {
  background: linear-gradient(135deg, #52c41a, #389e0d);
  color: white;
  border: none;
  box-shadow: 0 2px 4px rgba(82, 196, 26, 0.3);
}

.top-bookmark-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(82, 196, 26, 0.4);
}

.translate-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.translate-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

/* 英文內容樣式 */
:deep(.english-section) {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border-left: 4px solid #2196f3;
}

:deep(.english-section h4) {
  color: #1976d2 !important;
  font-style: italic;
}

:deep(.english-section p) {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* 高亮區域樣式 */
:deep(.highlight-section) {
  background: linear-gradient(135deg, #fff3cd, #ffeaa7);
  border-left: 4px solid #f39c12;
}

:deep(.highlight-section h4) {
  color: #d68910 !important;
}
</style>