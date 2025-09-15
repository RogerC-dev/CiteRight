import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBookmarkStore = defineStore('bookmark', () => {
  // 狀態
  const bookmarks = ref([])
  const isLoading = ref(false)
  
  // 計算屬性
  const bookmarkCount = computed(() => bookmarks.value.length)
  const hasBookmarks = computed(() => bookmarks.value.length > 0)
  
  // 動作
  async function loadBookmarks() {
    isLoading.value = true
    try {
      const saved = localStorage.getItem('citeright_bookmarks')
      if (saved) {
        const parsed = JSON.parse(saved)
        bookmarks.value = Array.isArray(parsed) ? parsed : []
        console.log('📚 已載入書籤:', bookmarks.value.length, '個項目')
      } else {
        bookmarks.value = []
        console.log('📚 沒有找到儲存的書籤')
      }
    } catch (error) {
      console.error('載入書籤失敗:', error)
      bookmarks.value = []
    } finally {
      isLoading.value = false
    }
  }
  
  function addBookmark(lawData) {
    if (!lawData) {
      console.log('❌ 無法加入書籤：沒有法律資料')
      return false
    }
    
    console.log('📚 嘗試加入書籤:', lawData)
    
    // 正規化書籤資料
    const normalizedBookmark = normalizeBookmarkItem(lawData)
    
    // 檢查是否已存在
    const exists = bookmarks.value.find(item => {
      // 首先檢查 ID 是否相同
      if (item.id === normalizedBookmark.id) {
        return true
      }

      // 對於法律條文，需要檢查法律名稱和條文號碼都相同才算重複
      if (item.type === 'law' && normalizedBookmark.type === 'law') {
        return item.lawName === normalizedBookmark.lawName &&
               item.number === normalizedBookmark.number
      }

      // 對於釋字，只需要檢查類型和號碼
      if (item.type === 'interpretation' && normalizedBookmark.type === 'interpretation') {
        return item.number === normalizedBookmark.number
      }

      // 其他情況，檢查類型和號碼
      return item.type === normalizedBookmark.type && item.number === normalizedBookmark.number
    })
    
    if (exists) {
      console.log('⚠️ 書籤已存在:', exists.title)
      return false
    }
    
    // 加入書籤
    bookmarks.value.push(normalizedBookmark)
    
    // 儲存到 localStorage
    saveBookmarks()
    
    console.log('✅ 已加入書籤:', normalizedBookmark.title)
    return true
  }
  
  function removeBookmark(bookmarkId) {
    const index = bookmarks.value.findIndex(b => b.id === bookmarkId)
    
    if (index > -1) {
      const removed = bookmarks.value.splice(index, 1)[0]
      saveBookmarks()
      console.log('🗑️ 已移除書籤:', removed.title)
      return true
    }
    
    console.log('❌ 找不到要移除的書籤:', bookmarkId)
    return false
  }
  
  function getBookmark(bookmarkId) {
    return bookmarks.value.find(b => b.id === bookmarkId) || null
  }
  
  function clearAllBookmarks() {
    bookmarks.value = []
    saveBookmarks()
    console.log('🗑️ 已清除所有書籤')
  }
  
  function saveBookmarks() {
    try {
      localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarks.value))
      console.log('💾 書籤已儲存，共', bookmarks.value.length, '個項目')
    } catch (error) {
      console.error('儲存書籤失敗:', error)
    }
  }
  
  function normalizeBookmarkItem(data) {
    const d = data || {}
    
    const isTypeInterpretation = typeof d.type === 'string' && (
      /interpret/i.test(d.type) || d.type === '釋字' || d.caseType === '釋字'
    )
    const looksLikeInterpretation = (
      isTypeInterpretation || !!d.issue || !!d.description || !!d.chinese?.issue || !!d.chinese?.description
    )
    
    const derivedNumber = d.number || d.articleNumber || d.ArticleNo || ''
    const derivedTitle = d.title || (
      looksLikeInterpretation
        ? (derivedNumber ? `釋字第${derivedNumber}號` : '解釋')
        : [d.CaptionTitle, derivedNumber].filter(Boolean).join(' ')
    ) || '未命名項目'
    
    let derivedFull = d.fullContent || d.content || ''
    let derivedPreview = d.content || ''
    
    if (looksLikeInterpretation) {
      // 提取釋字內容，優先使用中文數據
      const chineseDesc = d.chinese?.description || ''
      const chineseIssue = d.chinese?.issue || ''
      const chineseReasoning = d.chinese?.reasoning || ''
      const desc = d.description || chineseDesc || ''
      const issue = d.issue || chineseIssue || ''
      const reasoning = d.reasoning || chineseReasoning || ''

      // 組合完整內容
      const fullParts = []
      if (issue) fullParts.push(`解釋爭點：${issue}`)
      if (desc) fullParts.push(`解釋文：${desc}`)
      if (reasoning) fullParts.push(`理由書：${reasoning}`)

      derivedFull = fullParts.length > 0 ? fullParts.join('\n\n') : derivedFull
      derivedPreview = issue || desc || reasoning || derivedPreview

      // 如果還是沒有內容，嘗試從其他欄位取得
      if (!derivedPreview || derivedPreview === '無內容可顯示') {
        derivedPreview = d.content || d.fullContent || `釋字第${derivedNumber}號解釋`
      }
    } else {
      const articleText = (d.articleData && d.articleData.Article) || d.Article || ''
      if (!derivedFull) derivedFull = articleText
      if (!derivedPreview) derivedPreview = articleText
    }
    
    const derivedUrl = d.officialUrl || d.url || d.link || ''
    const derivedType = looksLikeInterpretation ? 'interpretation' : (d.type || 'law')
    const derivedId = d.id || `${derivedType}_${derivedNumber || Date.now()}`
    
    return {
      id: derivedId,
      type: derivedType,
      title: derivedTitle,
      number: derivedNumber,
      content: derivedPreview,
      fullContent: derivedFull,
      officialUrl: derivedUrl,
      lawData: d.lawData,
      articleData: d.articleData,
      date: d.date || d.dateAdded || undefined,
      dateAdded: new Date().toISOString(),
      // 保留釋字相關的重要字段
      issue: d.issue,
      description: d.description,
      reasoning: d.reasoning,
      chinese: d.chinese,
      english: d.english, // 保留英文內容以顯示 En 按鈕
      lawName: d.lawName,
      raw: d
    }
  }
  
  // 匯出書籤資料
  function exportBookmarks() {
    const dataStr = JSON.stringify(bookmarks.value, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `citeright-bookmarks-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    URL.revokeObjectURL(url)
    console.log('📤 書籤已匯出')
  }
  
  // 匯入書籤資料
  function importBookmarks(fileContent) {
    try {
      const importedBookmarks = JSON.parse(fileContent)
      if (Array.isArray(importedBookmarks)) {
        // 合併現有書籤，避免重複
        const existingIds = new Set(bookmarks.value.map(b => b.id))
        const newBookmarks = importedBookmarks.filter(b => !existingIds.has(b.id))
        
        bookmarks.value.push(...newBookmarks)
        saveBookmarks()
        
        console.log('📥 已匯入', newBookmarks.length, '個新書籤')
        return newBookmarks.length
      } else {
        throw new Error('匯入的資料格式不正確')
      }
    } catch (error) {
      console.error('匯入書籤失敗:', error)
      throw error
    }
  }
  
  return {
    // 狀態
    bookmarks,
    isLoading,
    
    // 計算屬性
    bookmarkCount,
    hasBookmarks,
    
    // 動作
    loadBookmarks,
    addBookmark,
    removeBookmark,
    getBookmark,
    clearAllBookmarks,
    exportBookmarks,
    importBookmarks
  }
})