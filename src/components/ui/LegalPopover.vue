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
            @click="$emit('bookmark')"
            title="加入書籤"
          >
            📚 書籤
          </button>
          <button
            class="action-btn expand-btn"
            @click="$emit('expand')"
            title="展開至側邊面板"
          >
            📖 展開
          </button>
          <button
            class="action-btn close-btn"
            @click="$emit('close')"
            title="關閉"
          >
            &times;
          </button>
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
          <!-- 釋字內容 -->
          <template v-if="contentData.type === '釋字'">
            {{ console.log(contentData) }}
            <div class="info-section">
              <strong>解釋字號：</strong>
              <div class="info-content">釋字第 {{ contentData.number }} 號</div>
            </div>
            <div v-if="contentData.date" class="info-section">
              <strong>解釋公布院令：</strong>
              <div class="info-content">{{ new Date(contentData.date).toLocaleDateString() }}</div>
            </div>
            <div v-if="contentData.chinese.issue" class="info-section">
              <strong>解釋爭點：</strong>
              <div class="info-content">{{ contentData.chinese.issue }}</div>
            </div>
            <div v-if="contentData.chinese.reasoning" class="info-section">
              <strong>解釋文：</strong>
              <div class="info-content">{{ contentData.chinese.reasoning }}</div>
            </div>
            <div class="info-section">
              <strong>來源：</strong>
              <div class="info-content">
                <a :href="getInterpretationUrl(contentData.number)" target="_blank" rel="noreferrer">線上解釋來源</a>
                <span v-if="contentData.source_url"> | 
                  <a :href="contentData.source_url" target="_blank" rel="noreferrer">資料庫來源</a>
                </span>
              </div>
            </div>
          </template>

          <!-- 法條內容 -->
          <template v-else-if="contentData.type === '法律'">
            {{ console.log(contentData) }}
            <div class="info-section">
              <strong>法規類別: </strong>
              <div class="info-content" v-if="contentData.LawLevel === contentData.LawCategory">{{ contentData.LawLevel || '' }}</div>
              <div class="info-content" v-else>{{ contentData.LawLevel || '' }} | {{ contentData.LawCategory || '' }}</div>
            </div>
            <div class="info-section">
              <strong>法律沿革: </strong>
              <div class="info-content">{{ contentData.LawHistories || '' }}</div>
            </div>
            <div class="info-section">
              <strong>修訂日期: </strong>
              <div class="info-content">{{ new Date(contentData.LawModifiedDate).toLocaleDateString() || '' }}</div>
            </div>
            <div class="info-section">
              <strong>條文內容：</strong>
              <div class="info-content" v-for="(article, index) in contentData.Articles" :key="index">
                <strong>{{ article.CaptionTitle }} {{ article.ArticleNo }}</strong>
                <span>{{ article.Article }}</span>
              </div>
            </div>
            <div v-if="contentData.LawUrl" class="info-section">
              <strong>來源：</strong>
              <div class="info-content"><a :href="contentData.LawUrl" target="_blank" rel="noreferrer">線上法條來源</a></div>
            </div>
          </template>

          <!-- 通用內容 -->
          <template v-else>
            {{ console.log(contentData) }}
            <div class="info-section">
              <strong>識別內容：</strong> {{ contentData.text || data?.text || '未知內容' }}
            </div>
            <div class="debug-info">
              類型: {{ contentData.type || '未知' }}<br>
              <template v-if="contentData.value.lawName">法律: {{ contentData.value.lawName }}<br></template>
              <template v-if="contentData.value.article">條文: {{ contentData.value.article }}<br></template>
              <template v-if="contentData.value.paragraph">項款目: {{ contentData.value.paragraph }}<br></template>
              <template v-if="contentData.value.year">年度: {{ contentData.value.year }}<br></template>
              <template v-if="contentData.value.number">字號: {{ contentData.value.number }}<br></template>
            </div>
          </template>
        </div>
        
        <div v-else class="no-data">
          <div class="no-data-icon">📋</div>
          <div class="no-data-text">暫無資料</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import {
  fetchInterpretation,
  fetchLawArticle,
  fetchLawInfo
} from '../../services/apiService.js'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  loading: {
    type: Boolean,
    default: false
  },
  data: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['close', 'bookmark', 'expand'])

// 狀態
const popoverRef = ref(null)
const contentData = ref(null)
const loading = ref(false)
const error = ref('')
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 計算屬性
const displayTitle = computed(() => {
  switch (contentData.value.type) {
    case '釋字':
      return `釋字第 ${contentData.value.number} 號`
    case '法律':
      return contentData.value.LawName || '法律內容'
    default:
      break
  }
  if (props.data?.title) return props.data.title
  return '台灣法源資訊'
})

const loadingMessage = computed(() => {
  if (!props.data) return '內容'
  
  switch (props.data.type || props.data.caseType) {
    case '釋字':
      return '釋字內容'
    case '法律':
      return '法律內容'
    default:
      return '法律內容'
  }
})

const popoverStyle = computed(() => ({
  position: 'fixed',
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  zIndex: 2147483650
}))

// 監聽 data 變化，自動載入內容
watch(() => props.data, async (newData) => {
  if (!newData) {
    contentData.value = null
    error.value = ''
    return
  }

  await loadContent(newData)
}, { immediate: true })

// 監聽顯示狀態，處理 ESC 鍵
watch(() => props.show, (show) => {
  if (show) {
    document.addEventListener('keydown', handleKeyDown)
  } else {
    document.removeEventListener('keydown', handleKeyDown)
  }
})

/**
 * 載入內容
 */
async function loadContent(data) {
  if (!data) return

  loading.value = true
  error.value = ''

  try {
    const caseType = data.type
    console.log('載入內容:', caseType, data);

    if (caseType === '釋字') {
      // 載入釋字內容
      const result = await fetchInterpretation(data.number)
      contentData.value = result
    } else if (caseType === '法律') {
      // 檢查是否已有預載入的內容
      if (data.content && data.content !== `正在載入${data.lawName}的詳細內容...`) {
        // 使用預載入的內容
        contentData.value = {
          type: '法律',
          LawName: data.lawName || data.title,
          LawUrl: data.officialUrl,
          content: data.content,
          ...data
        }
      } else if (data.lawName) {
        // 載入法條內容
        const result = await fetchLawInfo(data.lawName)
        contentData.value = result
      } else {
        // 沒有法律名稱，使用原始資料
        contentData.value = {
          type: '法律',
          LawName: data.title || '法律資訊',
          ...data
        }
      }
    } else {
      // 使用原始資料
      contentData.value = {
        type: caseType || '法律資訊',
        title: data.title || '台灣法源資訊',
        ...data
      }
    }
  } catch (err) {
    console.error('載入內容失敗:', err)
    error.value = err.message || '載入內容時發生錯誤'
    contentData.value = null
  } finally {
    loading.value = false
  }
}

/**
 * 處理鍵盤事件
 */
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

/**
 * 開始拖拽
 */
function startDrag(e) {
  if (e.target.classList.contains('action-btn')) return
  
  isDragging.value = true
  const rect = popoverRef.value.getBoundingClientRect()
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

/**
 * 處理拖拽
 */
function handleDrag(e) {
  if (!isDragging.value || !popoverRef.value) return
  
  let left = e.clientX - dragOffset.value.x
  let top = e.clientY - dragOffset.value.y
  
  // 限制在視窗範圍內
  const popoverRect = popoverRef.value.getBoundingClientRect()
  left = Math.max(0, Math.min(left, window.innerWidth - popoverRect.width))
  top = Math.max(0, Math.min(top, window.innerHeight - 50))
  
  popoverRef.value.style.left = left + 'px'
  popoverRef.value.style.top = top + 'px'
}

/**
 * 停止拖拽
 */
function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

/**
 * 產生大法官解釋 URL
 */
function getInterpretationUrl(number) {
  if (!number) return '#'
  return `https://cons.judicial.gov.tw/jcc/zh-tw/jep03/show?expno=${number}`
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

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  font-size: 18px;
}

.title {
  font-weight: 600;
  font-size: 16px;
  color: #f0f8ff;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  opacity: 0.95;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.close-btn {
  border-radius: 50%;
  padding: 6px;
  font-size: 16px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.citeright-content {
  padding: 18px;
  max-height: 320px;
  overflow-y: auto;
  background: white;
  border-radius: 0 0 10px 10px;
  line-height: 1.6;
}

.citeright-content::-webkit-scrollbar {
  width: 6px;
}

.citeright-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.citeright-content::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.loading-state,
.error-state,
.no-data {
  text-align: center;
  padding: 20px;
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

.loading-text {
  color: #666;
  font-size: 13px;
}

.error-icon,
.no-data-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.error-text,
.no-data-text {
  color: #666;
  font-size: 13px;
}

.info-section {
  margin-bottom: 12px;
}

.info-section strong {
  color: #1890ff;
  display: block;
  margin-bottom: 4px;
}

.info-content {
  line-height: 1.6;
  color: #333;
}

.debug-info {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.content-loaded {
  animation: fadeIn 0.3s ease-out;
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
</style>