<template>
  <Teleport to="body">
    <div
      v-if="show"
      id="citeright-popover"
      ref="popoverRef"
      :style="popoverStyle"
      class="citeright-popover"
      @click.stop
    >
      <!-- 標題欄 -->
      <div class="citeright-header" @mousedown="startDrag">
        <div class="header-left">
          <span class="icon">⚖️</span>
          <span class="title">{{ displayTitle }}</span>
        </div>
        <div class="header-right">
          <button
            class="action-btn bookmark-btn"
            @click="handleBookmark"
            :disabled="isBookmarking"
            title="加入書籤"
          >
            📚 {{ isAlreadyBookmarked ? '已收藏' : '加入書籤' }}
          </button>
          <button class="action-btn expand-btn" @click="$emit('expand')" title="展開至側邊面板">📖 展開</button>
          <button class="action-btn close-btn" @click="$emit('close')" title="關閉">&times;</button>
        </div>
      </div>

      <!-- 內容區域 -->
      <div class="citeright-content">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">🔍 正在載入{{ loadingMessage }}...</div>
        </div>

        <div v-else-if="error" class="error-state">
          <div class="error-icon">❌</div>
          <div class="error-text">{{ error }}</div>
        </div>

        <div v-else-if="contentData" class="content-loaded">
          <!-- 釋字內容 / Interpretation -->
          <template v-if="kind === 'interpretation'">
            <div v-if="contentData.date" class="info-section">
              <strong>解釋公布院令：</strong>
              <div class="info-content">{{ new Date(contentData.date).toLocaleDateString() }}</div>
            </div>
            <div v-if="contentData.chinese?.issue || contentData.issue" class="info-section highlight-section">
              <strong>解釋爭點：</strong>
              <div class="info-content">{{ contentData.chinese?.issue || contentData.issue }}</div>
            </div>

            <div v-if="contentData.chinese?.description || contentData.description" class="info-section">
              <strong>解釋文：</strong>
              <div class="info-content">{{ contentData.chinese?.description || contentData.description }}</div>
            </div>

            <div v-if="contentData.chinese?.reasoning || contentData.reasoning" class="info-section">
              <strong>理由書：</strong>
              <div class="info-content">{{ contentData.chinese?.reasoning || contentData.reasoning }}</div>
            </div>
            <div class="info-section">
              <strong>來源：</strong>
              <div class="info-content">
                <a :href="contentData.url || getInterpretationUrl(contentData.number)" target="_blank" rel="noreferrer">線上解釋來源</a>
                <span v-if="contentData.source_url"> |
                  <a :href="contentData.source_url" target="_blank" rel="noreferrer">資料庫來源</a>
                </span>
              </div>
            </div>
          </template>

          <!-- 法律 / Law -->
          <template v-else-if="kind === 'law'">
            <div v-if="contentData.LawModifiedDate" class="info-section">
              <strong>修訂日期：</strong>
              <div class="info-content">{{ new Date(contentData.LawModifiedDate).toLocaleDateString() }}</div>
            </div>
            <div v-if="Array.isArray(contentData.Articles) && contentData.Articles.length" class="info-section">
              <strong>條文內容：</strong>
              <div class="law-articles-container">
                <div
                  v-for="(article, index) in contentData.Articles"
                  :key="index"
                  class="law-article-item"
                >
                  <div class="article-header">
                    <span class="article-number">{{ article.ArticleNo }}</span>
                    <span v-if="article.CaptionTitle" class="article-caption">{{ article.CaptionTitle }}</span>
                  </div>
                  <div class="article-content">{{ article.Article }}</div>
                </div>
              </div>
            </div>
            <div v-if="contentData.LawUrl" class="info-section">
              <strong>來源：</strong>
              <div class="info-content"><a :href="contentData.LawUrl" target="_blank" rel="noreferrer">線上法條來源</a></div>
            </div>
          </template>

          <!-- 通用內容 / Fallback -->
          <template v-else>
            <div class="info-section">
              <strong>識別內容：</strong> {{ contentData.text || data?.text || '未知內容' }}
            </div>
            <div class="debug-info">
              類型: {{ contentData.type || '未知' }}<br>
              <template v-if="lawName">法律: {{ lawName }}<br></template>
              <template v-if="article">條文: {{ article }}<br></template>
              <template v-if="paragraph">條款: {{ paragraph }}<br></template>
              <template v-if="year">年度: {{ year }}<br></template>
              <template v-if="number">字號: {{ number }}<br></template>
            </div>
          </template>
        </div>

        <div v-else class="no-data">
          <div class="no-data-icon">🗂️</div>
          <div class="no-data-text">尚無資料</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { fetchInterpretation, fetchLawInfo } from '../../services/apiService.js'
import { useBookmarkStore } from '../../stores/bookmark.js'

// Props
const props = defineProps({
  show: { type: Boolean, default: false },
  position: { type: Object, default: () => ({ x: 0, y: 0 }) },
  loading: { type: Boolean, default: false },
  data: { type: Object, default: null },
  error: { type: String, default: '' }
})

// Emits
const emit = defineEmits(['close', 'bookmark', 'expand'])

// State
const bookmarkStore = useBookmarkStore()
const popoverRef = ref(null)
const contentData = ref(null)
const loading = ref(false)
const error = ref('')
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const isBookmarking = ref(false)

// Normalized helpers for mixed shapes
const lawName = computed(() => props.data?.lawName ?? props.data?.value?.lawName)
const article = computed(() => props.data?.article ?? props.data?.value?.article)
const paragraph = computed(() => props.data?.paragraph ?? props.data?.value?.paragraph)
const year = computed(() => props.data?.year ?? props.data?.value?.year)
const number = computed(() => props.data?.number ?? props.data?.value?.number)

const kind = computed(() => {
  const t = (contentData.value?.type || props.data?.type || '').toString().toLowerCase()
  if (t === '法律' || t === 'law') return 'law'
  if (t === '釋字' || t === 'interpretation') return 'interpretation'
  return 'other'
})

const displayTitle = computed(() => {
  const cd = contentData.value
  if (!cd) return props.data?.title || '法律資訊'
  switch (kind.value) {
    case 'interpretation':
      return `釋字第 ${cd?.number ?? ''} 號`
    case 'law':
      return cd?.LawName || props.data?.title || lawName.value || '法律內容'
    default:
      return props.data?.title || '臺灣法律資訊'
  }
})

const loadingMessage = computed(() => {
  const t = (props.data?.type || '').toString().toLowerCase()
  if (t === '釋字' || t === 'interpretation') return '釋字內容'
  if (t === '法律' || t === 'law') return '法律內容'
  return '內容'
})

const popoverStyle = computed(() => ({
  position: 'fixed',
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  zIndex: 2147483650
}))

const isAlreadyBookmarked = computed(() => {
  if (!contentData.value && !props.data) return false

  const dataToCheck = contentData.value || props.data
  return bookmarkStore.bookmarks.some(bookmark => {
    // 精確 ID 匹配
    if (bookmark.id === dataToCheck.id) return true

    // 釋字匹配：類型和號碼都要相同
    if (bookmark.type === 'interpretation' && dataToCheck.type === 'interpretation') {
      return bookmark.number === dataToCheck.number
    }

    // 法律匹配：法律名稱要相同
    if (bookmark.type === 'law' && dataToCheck.type === 'law') {
      return bookmark.lawName === dataToCheck.lawName ||
             bookmark.LawName === dataToCheck.LawName ||
             bookmark.title === dataToCheck.title
    }

    // 條文匹配：法律名稱和條文號要都相同
    if (bookmark.lawName && dataToCheck.lawName && bookmark.article && dataToCheck.article) {
      return bookmark.lawName === dataToCheck.lawName && bookmark.article === dataToCheck.article
    }

    // 標題完全匹配（備用方案）
    if (bookmark.title === dataToCheck.title && bookmark.title.length > 5) {
      return true
    }

    return false
  })
})

// Watch data -> load content
watch(
  () => props.data,
  async (newData) => {
    if (!newData) {
      contentData.value = null
      error.value = ''
      return
    }
    await loadContent(newData)
  },
  { immediate: true }
)

// ESC to close when showing
watch(
  () => props.show,
  (show) => {
    if (show) {
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }
)

async function loadContent(data) {
  if (!data) return
  loading.value = true
  error.value = ''
  try {
    const caseType = (data.type || '').toString().toLowerCase()
    if (caseType === '釋字' || caseType === 'interpretation') {
      // 如果已經有完整的釋字數據（如來自書籤），直接使用
      if (data.issue || data.description || data.reasoning || data.chinese?.issue || data.chinese?.description) {
        console.log('🔖 使用現有釋字數據:', data.title)
        contentData.value = {
          type: 'interpretation',
          number: data.number,
          title: data.title,
          ...data
        }
      } else {
        // 否則從 API 載入
        console.log('🌐 從 API 載入釋字數據:', data.number)
        const result = await fetchInterpretation(data.number)
        contentData.value = result
      }
    } else if (caseType === '法律' || caseType === 'law') {
      if (data.content && data.content !== `正在載入${data.lawName}的詳細內容..`) {
        contentData.value = {
          type: '法律',
          LawName: data.lawName || data.title,
          LawUrl: data.officialUrl,
          content: data.content,
          ...data
        }
      } else if (data.lawName) {
        const result = await fetchLawInfo(data.lawName)
        contentData.value = result
      } else {
        contentData.value = {
          type: '法律',
          LawName: data.title || '法律資訊',
          ...data
        }
      }
    } else {
      contentData.value = { type: caseType || '其他', title: data.title || '臺灣法律資訊', ...data }
    }
  } catch (err) {
    console.error('載入內容失敗:', err)
    error.value = err?.message || '載入內容發生錯誤'
    contentData.value = null
  } finally {
    loading.value = false
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

function startDrag(e) {
  if (e.target.classList?.contains('action-btn')) return
  isDragging.value = true
  const rect = popoverRef.value.getBoundingClientRect()
  dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function handleDrag(e) {
  if (!isDragging.value || !popoverRef.value) return
  let left = e.clientX - dragOffset.value.x
  let top = e.clientY - dragOffset.value.y
  const popoverRect = popoverRef.value.getBoundingClientRect()
  left = Math.max(0, Math.min(left, window.innerWidth - popoverRect.width))
  top = Math.max(0, Math.min(top, window.innerHeight - 50))
  popoverRef.value.style.left = left + 'px'
  popoverRef.value.style.top = top + 'px'
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function getInterpretationUrl(number) {
  return `https://cons.judicial.gov.tw/docdata.aspx?fid=100&type=JY&RD=${number}`
}

/**
 * 處理書籤操作
 */
async function handleBookmark() {
  const dataToBookmark = contentData.value || props.data

  if (!dataToBookmark || isBookmarking.value) {
    console.log('❌ 無法加入書籤：沒有法律資料')
    return
  }

  isBookmarking.value = true

  try {
    // 準備書籤數據
    const bookmarkData = {
      ...dataToBookmark,
      id: dataToBookmark.id || `${dataToBookmark.type || 'law'}_${Date.now()}`,
      title: dataToBookmark.title || displayTitle.value,
      type: dataToBookmark.type || 'law',
      dateAdded: new Date().toISOString()
    }

    if (isAlreadyBookmarked.value) {
      // 移除書籤
      const success = bookmarkStore.removeBookmark(bookmarkData.id)
      if (success) {
        console.log('✅ 已移除書籤:', bookmarkData.title)
      }
    } else {
      // 加入書籤
      const success = bookmarkStore.addBookmark(bookmarkData)
      if (success) {
        console.log('✅ 已加入書籤:', bookmarkData.title)
      } else {
        console.log('⚠️ 書籤已存在:', bookmarkData.title)
      }
    }
  } catch (error) {
    console.error('書籤操作失敗:', error)
  } finally {
    isBookmarking.value = false
  }
}
</script>

<style scoped>
.citeright-popover {
  background: #fff;
  border: 2px solid #1890ff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  width: 480px;
  max-width: 95vw;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  font-size: 14px;
  color: #333;
  pointer-events: auto;
  backdrop-filter: blur(8px);
}

.citeright-header {
  padding: 14px 18px;
  background: linear-gradient(135deg, #1890ff, #096dd9);
  color: white;
  border-radius: 10px 10px 0 0;
  cursor: move;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left { display: flex; align-items: center; gap: 8px; }
.icon { font-size: 18px; }
.title { font-weight: 600; font-size: 16px; color: #f0f8ff; text-shadow: 1px 1px 3px rgba(0,0,0,.5); opacity: .95; }
.header-right { display: flex; align-items: center; gap: 8px; }
.action-btn { background: rgba(255,255,255,.2); border: none; color: white; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px; transition: all .2s; }
.action-btn:hover { background: rgba(255,255,255,.3); transform: scale(1.05); }
.close-btn { border-radius: 50%; padding: 6px; font-size: 16px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }

.citeright-content { padding: 18px; max-height: 320px; overflow-y: auto; background: white; border-radius: 0 0 10px 10px; line-height: 1.6; }
.citeright-content::-webkit-scrollbar { width: 6px; }
.citeright-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.citeright-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.citeright-content::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }

.loading-state, .error-state, .no-data { text-align: center; padding: 20px; }
.spinner { width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #1890ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.loading-text { color: #666; font-size: 13px; }
.error-icon, .no-data-icon { font-size: 24px; margin-bottom: 8px; }
.error-text, .no-data-text { color: #666; font-size: 13px; }

.info-section { margin-bottom: 12px; }
.info-section strong { color: #1890ff; display: block; margin-bottom: 4px; }
.info-content { line-height: 1.6; color: #333; }

.debug-info { font-size: 12px; color: #666; line-height: 1.4; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }

.content-loaded { animation: fadeIn .3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 法律條文顯示樣式 */
.law-articles-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fafafa;
}

.law-articles-container::-webkit-scrollbar {
  width: 6px;
}

.law-articles-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.law-articles-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.law-articles-container::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.law-article-item {
  padding: 12px;
  border-bottom: 1px solid #e8e8e8;
  background: white;
}

.law-article-item:last-child {
  border-bottom: none;
}

.article-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.article-number {
  background: linear-gradient(135deg, #52c41a, #389e0d);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.article-caption {
  color: #1890ff;
  font-weight: 600;
  font-size: 13px;
}

.article-content {
  color: #333;
  line-height: 1.6;
  font-size: 13px;
}
</style>
