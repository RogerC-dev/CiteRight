<template>
  <div class="bookmark-content">
    <!-- 標題區域 -->
    <div class="content-header">
      <h3 class="section-title">
        📚 我的法律書籤 ({{ bookmarkStore.bookmarkCount }})
      </h3>
      <div v-if="bookmarkStore.hasBookmarks" class="header-actions">
        <button class="action-btn export-btn" @click="exportBookmarks">
          📤 匯出
        </button>
        <button class="action-btn import-btn" @click="triggerImport">
          📥 匯入
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleImport"
        >
      </div>
    </div>

    <!-- 載入狀態 -->
    <div v-if="bookmarkStore.isLoading" class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">正在載入書籤...</div>
    </div>

    <!-- 空狀態 -->
    <div v-else-if="!bookmarkStore.hasBookmarks" class="empty-state">
      <div class="empty-icon">📚</div>
      <div class="empty-title">尚未儲存任何書籤</div>
      <div class="empty-subtitle">在法條詳情中點擊「加入書籤」來儲存</div>
    </div>

    <!-- 書籤列表 -->
    <div v-else class="bookmark-list">
      <TransitionGroup name="bookmark" tag="div">
        <div
          v-for="bookmark in sortedBookmarks"
          :key="bookmark.id"
          class="bookmark-item"
          @click="viewBookmark(bookmark)"
        >
          <div class="bookmark-main">
            <div class="bookmark-title">{{ bookmark.title }}</div>
            <div class="bookmark-meta">
              {{ formatBookmarkType(bookmark.type) }} · 
              儲存於 {{ formatDate(bookmark.dateAdded) }}
            </div>
            <div class="bookmark-preview">
              {{ getPreviewText(bookmark) }}
            </div>
          </div>
          
          <div class="bookmark-actions">
            <button
              class="action-btn view-btn"
              @click.stop="viewBookmark(bookmark)"
              title="查看詳情"
            >
              👁️
            </button>
            <button
              class="action-btn edit-btn"
              @click.stop="editBookmark(bookmark)"
              title="編輯"
            >
              ✏️
            </button>
            <button
              class="action-btn delete-btn"
              @click.stop="deleteBookmark(bookmark)"
              title="刪除"
            >
              🗑️
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- 編輯書籤對話框 -->
    <div v-if="editingBookmark" class="edit-modal" @click.self="cancelEdit">
      <div class="edit-dialog">
        <div class="edit-header">
          <h4>編輯書籤</h4>
          <button class="close-btn" @click="cancelEdit">&times;</button>
        </div>
        
        <div class="edit-body">
          <div class="form-group">
            <label>標題</label>
            <input
              v-model="editForm.title"
              type="text"
              class="form-control"
              placeholder="書籤標題"
            >
          </div>
          
          <div class="form-group">
            <label>備註</label>
            <textarea
              v-model="editForm.notes"
              class="form-control"
              rows="3"
              placeholder="添加個人備註（可選）"
            ></textarea>
          </div>
        </div>
        
        <div class="edit-footer">
          <button class="btn btn-secondary" @click="cancelEdit">取消</button>
          <button class="btn btn-primary" @click="saveEdit">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBookmarkStore } from '../../stores/bookmark.js'

const bookmarkStore = useBookmarkStore()

// 引用
const fileInputRef = ref(null)

// 狀態
const editingBookmark = ref(null)
const editForm = ref({
  title: '',
  notes: ''
})
const sortOrder = ref('date') // 'date' | 'title' | 'type'

// 計算屬性
const sortedBookmarks = computed(() => {
  const bookmarks = [...bookmarkStore.bookmarks]
  
  switch (sortOrder.value) {
    case 'title':
      return bookmarks.sort((a, b) => a.title.localeCompare(b.title))
    case 'type':
      return bookmarks.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        return new Date(b.dateAdded) - new Date(a.dateAdded)
      })
    case 'date':
    default:
      return bookmarks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
  }
})

/**
 * 查看書籤詳情
 */
function viewBookmark(bookmark) {
  console.log('👁️ 查看書籤:', bookmark.title)
  
  // 發送事件通知父組件切換到工具分頁並載入內容
  window.dispatchEvent(new CustomEvent('citeright:load-bookmark', {
    detail: bookmark
  }))
  
  // 切換到工具分頁
  const event = new CustomEvent('citeright:switch-tab', {
    detail: { tab: 'tool' }
  })
  window.dispatchEvent(event)
}

/**
 * 編輯書籤
 */
function editBookmark(bookmark) {
  console.log('✏️ 編輯書籤:', bookmark.title)
  
  editingBookmark.value = bookmark
  editForm.value = {
    title: bookmark.title,
    notes: bookmark.notes || ''
  }
}

/**
 * 取消編輯
 */
function cancelEdit() {
  editingBookmark.value = null
  editForm.value = { title: '', notes: '' }
}

/**
 * 儲存編輯
 */
function saveEdit() {
  if (!editingBookmark.value) return
  
  const updatedBookmark = {
    ...editingBookmark.value,
    title: editForm.value.title.trim() || editingBookmark.value.title,
    notes: editForm.value.notes.trim(),
    lastModified: new Date().toISOString()
  }
  
  // 更新書籤（這裡需要在 store 中添加 updateBookmark 方法）
  const index = bookmarkStore.bookmarks.findIndex(b => b.id === editingBookmark.value.id)
  if (index > -1) {
    bookmarkStore.bookmarks[index] = updatedBookmark
    
    // 儲存到 localStorage
    localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkStore.bookmarks))
    
    window.dispatchEvent(new CustomEvent('citeright:notification', {
      detail: {
        title: '書籤已更新',
        subtitle: updatedBookmark.title,
        type: 'success'
      }
    }))
  }
  
  cancelEdit()
}

/**
 * 刪除書籤
 */
function deleteBookmark(bookmark) {
  if (confirm(`確定要刪除書籤「${bookmark.title}」嗎？`)) {
    const success = bookmarkStore.removeBookmark(bookmark.id)
    if (success) {
      window.dispatchEvent(new CustomEvent('citeright:bookmark-removed', {
        detail: { title: bookmark.title }
      }))
    }
  }
}

/**
 * 匯出書籤
 */
function exportBookmarks() {
  bookmarkStore.exportBookmarks()
  
  window.dispatchEvent(new CustomEvent('citeright:notification', {
    detail: {
      title: '書籤已匯出',
      subtitle: `共 ${bookmarkStore.bookmarkCount} 個書籤`,
      type: 'success'
    }
  }))
}

/**
 * 觸發匯入檔案選擇
 */
function triggerImport() {
  fileInputRef.value?.click()
}

/**
 * 處理匯入檔案
 */
async function handleImport(event) {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const importedCount = bookmarkStore.importBookmarks(text)
    
    window.dispatchEvent(new CustomEvent('citeright:notification', {
      detail: {
        title: '書籤匯入成功',
        subtitle: `新增了 ${importedCount} 個書籤`,
        type: 'success'
      }
    }))
  } catch (error) {
    console.error('匯入書籤失敗:', error)
    
    window.dispatchEvent(new CustomEvent('citeright:error', {
      detail: {
        title: '書籤匯入失敗',
        subtitle: error.message
      }
    }))
  } finally {
    // 清空檔案輸入
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

/**
 * 格式化書籤類型
 */
function formatBookmarkType(type) {
  switch (type) {
    case 'interpretation':
      return '釋字'
    case 'law':
      return '法條'
    case 'judgment':
      return '判決'
    default:
      return type || '法律資訊'
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
 * 取得預覽文字
 */
function getPreviewText(bookmark) {
  const content = bookmark.content || bookmark.fullContent || ''
  if (!content) return '無內容摘要'
  
  // 移除 HTML 標籤
  const textContent = content.replace(/<[^>]*>/g, '').trim()
  
  // 限制長度
  return textContent.length > 100 
    ? textContent.substring(0, 100) + '...'
    : textContent
}

// 監聽全域事件
onMounted(() => {
  // 監聽從工具分頁發送的書籤載入請求
  window.addEventListener('citeright:load-bookmark', (event) => {
    viewBookmark(event.detail)
  })
})
</script>

<style scoped>
.bookmark-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  color: #1890ff;
  word-break: keep-all;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
  background: white;
}

.export-btn, .import-btn {
  border-color: #1890ff;
  color: #1890ff;
}

.export-btn:hover, .import-btn:hover {
  background: #f0f9ff;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

.bookmark-list {
  flex: 1;
  overflow-y: auto;
}

.bookmark-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid #e8e8e8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.bookmark-item:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

.bookmark-main {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
  word-break: break-word;
}

.bookmark-meta {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.bookmark-preview {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bookmark-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.view-btn {
  border-color: #1890ff;
  color: #1890ff;
}

.view-btn:hover {
  background: #f0f9ff;
}

.edit-btn {
  border-color: #52c41a;
  color: #52c41a;
}

.edit-btn:hover {
  background: #f6ffed;
}

.delete-btn {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.delete-btn:hover {
  background: #fff2f0;
}

/* 編輯對話框 */
.edit-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.edit-dialog {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.edit-header {
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-header h4 {
  margin: 0;
  color: #1890ff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.edit-body {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.edit-footer {
  padding: 16px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 6px 16px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-secondary {
  border-color: #d9d9d9;
  color: #666;
  background: white;
}

.btn-secondary:hover {
  border-color: #bbb;
}

.btn-primary {
  border-color: #1890ff;
  color: white;
  background: #1890ff;
}

.btn-primary:hover {
  background: #096dd9;
  border-color: #096dd9;
}

/* 動畫 */
.bookmark-enter-active,
.bookmark-leave-active {
  transition: all 0.3s ease;
}

.bookmark-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.bookmark-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.bookmark-move {
  transition: transform 0.3s ease;
}
</style>