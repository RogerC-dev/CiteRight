<template>
  <div class="flashcard-manager">
    <!-- 標題和操作欄 -->
    <div class="manager-header">
      <h2>🃏 記憶卡片管理</h2>
      <div class="header-actions">
        <button @click="createBookmarkQuiz" class="bookmark-quiz-btn">
          📚 書籤測驗
        </button>
        <button @click="showCreateDeck = true" class="create-btn">
          ➕ 新增牌組
        </button>
        <button @click="showImportDeck = true" class="import-btn">
          📥 匯入牌組
        </button>
      </div>
    </div>

    <!-- 統計概覽 -->
    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-number">{{ deckCount }}</div>
        <div class="stat-label">牌組總數</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ totalCards }}</div>
        <div class="stat-label">卡片總數</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ todayStudied }}</div>
        <div class="stat-label">今日已學</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ dueCards }}</div>
        <div class="stat-label">待復習</div>
      </div>
    </div>

    <!-- 牌組列表 -->
    <div class="deck-list">
      <div
        v-for="deck in sortedDecks"
        :key="deck.id"
        class="deck-item"
      >
        <div class="deck-info">
          <div class="deck-header">
            <h3>{{ deck.name }}</h3>
            <div class="deck-badges">
              <span :class="['difficulty-badge', deck.difficulty]">
                {{ getDifficultyText(deck.difficulty) }}
              </span>
              <span class="category-badge">{{ deck.category }}</span>
            </div>
          </div>

          <p class="deck-description">{{ deck.description }}</p>

          <div class="deck-tags">
            <span v-for="tag in deck.tags" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>

          <div class="deck-stats">
            <div class="stat">
              <span class="stat-value">{{ deck.stats.totalCards }}</span>
              <span class="stat-label">卡片</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ deck.stats.studiedToday }}</span>
              <span class="stat-label">今日</span>
            </div>
            <div class="stat" v-if="deck.stats.averageScore > 0">
              <span class="stat-value">{{ Math.round(deck.stats.averageScore * 100 / 3) }}%</span>
              <span class="stat-label">準確率</span>
            </div>
            <div class="stat" v-if="deck.stats.lastStudied">
              <span class="stat-value">{{ getRelativeTime(deck.stats.lastStudied) }}</span>
              <span class="stat-label">上次學習</span>
            </div>
          </div>
        </div>

        <div class="deck-actions">
          <button @click="startStudy(deck)" class="study-btn" title="開始學習">
            🎓 學習
          </button>
          <button @click="editDeck(deck)" class="edit-btn" title="編輯牌組">
            ✏️ 編輯
          </button>
          <button @click="exportDeck(deck.id)" class="export-btn" title="匯出牌組">
            📤 匯出
          </button>
          <button @click="deleteDeck(deck)" class="delete-btn" title="刪除牌組">
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="!hasDecks" class="no-decks">
        <div class="no-decks-content">
          <h3>還沒有任何牌組</h3>
          <p>建立你的第一個記憶卡片牌組，開始學習台灣法律知識！</p>
          <button @click="showCreateDeck = true" class="create-first-deck-btn">
            ➕ 建立第一個牌組
          </button>
        </div>
      </div>
    </div>

    <!-- 新增/編輯牌組對話框 -->
    <div v-if="showCreateDeck || editingDeck" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingDeck ? '編輯牌組' : '新增牌組' }}</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveDeck" class="deck-form">
          <div class="form-group">
            <label for="deck-name">牌組名稱</label>
            <input
              id="deck-name"
              v-model="deckForm.name"
              type="text"
              required
              placeholder="例如：民法總則基礎"
            >
          </div>

          <div class="form-group">
            <label for="deck-description">描述</label>
            <textarea
              id="deck-description"
              v-model="deckForm.description"
              placeholder="描述這個牌組的內容和用途"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="deck-category">分類</label>
              <select id="deck-category" v-model="deckForm.category">
                <option value="constitutional">憲法</option>
                <option value="civil">民法</option>
                <option value="criminal">刑法</option>
                <option value="administrative">行政法</option>
                <option value="commercial">商法</option>
                <option value="procedural">程序法</option>
                <option value="general">一般</option>
              </select>
            </div>

            <div class="form-group">
              <label for="deck-difficulty">難度</label>
              <select id="deck-difficulty" v-model="deckForm.difficulty">
                <option value="beginner">初級</option>
                <option value="intermediate">中級</option>
                <option value="advanced">高級</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="deck-tags">標籤 (用逗號分隔)</label>
            <input
              id="deck-tags"
              v-model="tagsInput"
              type="text"
              placeholder="例如：基礎,考試,重要"
            >
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">
              取消
            </button>
            <button type="submit" class="save-btn">
              {{ editingDeck ? '更新' : '建立' }}
            </button>
          </div>
        </form>

        <!-- 編輯模式下的卡片管理 -->
        <div v-if="editingDeck" class="card-management">
          <div class="card-management-header">
            <h4>卡片管理</h4>
            <button @click="showAddCard = true" class="add-card-btn">
              ➕ 新增卡片
            </button>
          </div>

          <div class="card-list">
            <div
              v-for="(card, index) in editingDeck.cards"
              :key="card.id"
              class="card-item"
            >
              <div class="card-preview">
                <div class="card-question">
                  <strong>Q:</strong> {{ truncateText(card.question, 80) }}
                </div>
                <div class="card-answer">
                  <strong>A:</strong> {{ truncateText(card.answer, 80) }}
                </div>
                <div class="card-meta">
                  <span class="card-category">{{ card.category }}</span>
                  <span :class="['card-difficulty', card.difficulty]">
                    {{ getDifficultyText(card.difficulty) }}
                  </span>
                </div>
              </div>
              <div class="card-actions">
                <button @click="editCard(card, index)" class="edit-card-btn">✏️</button>
                <button @click="deleteCard(index)" class="delete-card-btn">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/編輯卡片對話框 -->
    <div v-if="showAddCard || editingCard" class="modal-overlay" @click="closeCardModal">
      <div class="modal-content card-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ editingCard ? '編輯卡片' : '新增卡片' }}</h3>
          <button @click="closeCardModal" class="close-btn">&times;</button>
        </div>

        <form @submit.prevent="saveCard" class="card-form">
          <div class="form-group">
            <label for="card-question">問題</label>
            <textarea
              id="card-question"
              v-model="cardForm.question"
              required
              placeholder="輸入問題或題目"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="card-answer">答案</label>
            <textarea
              id="card-answer"
              v-model="cardForm.answer"
              required
              placeholder="輸入答案"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="card-explanation">解釋說明 (選填)</label>
            <textarea
              id="card-explanation"
              v-model="cardForm.explanation"
              placeholder="提供詳細的解釋或背景資訊"
              rows="2"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="card-category">類別</label>
              <input
                id="card-category"
                v-model="cardForm.category"
                type="text"
                placeholder="例如：基本權利"
              >
            </div>

            <div class="form-group">
              <label for="card-difficulty">難度</label>
              <select id="card-difficulty" v-model="cardForm.difficulty">
                <option value="beginner">初級</option>
                <option value="intermediate">中級</option>
                <option value="advanced">高級</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="card-source">來源 (選填)</label>
            <input
              id="card-source"
              v-model="cardForm.source"
              type="text"
              placeholder="例如：釋字第812號"
            >
          </div>

          <div class="form-group">
            <label for="card-tags">標籤 (用逗號分隔)</label>
            <input
              id="card-tags"
              v-model="cardTagsInput"
              type="text"
              placeholder="例如：人身自由,比例原則"
            >
          </div>

          <div class="form-actions">
            <button type="button" @click="closeCardModal" class="cancel-btn">
              取消
            </button>
            <button type="submit" class="save-btn">
              {{ editingCard ? '更新' : '新增' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 匯入牌組對話框 -->
    <div v-if="showImportDeck" class="modal-overlay" @click="showImportDeck = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>匯入牌組</h3>
          <button @click="showImportDeck = false" class="close-btn">&times;</button>
        </div>

        <div class="import-content">
          <p>選擇要匯入的牌組 JSON 檔案：</p>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFileImport"
            class="file-input"
          >
          <div class="import-hint">
            <p>💡 提示：</p>
            <ul>
              <li>支援 JSON 格式的牌組檔案</li>
              <li>匯入的牌組會保留原有的卡片和設定</li>
              <li>重複的牌組會被自動重新命名</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFlashcardStore } from '../../stores/flashcard'

// Store
const flashcardStore = useFlashcardStore()

// Emit
const emit = defineEmits(['start-study'])

// 響應式數據
const showCreateDeck = ref(false)
const showAddCard = ref(false)
const showImportDeck = ref(false)
const editingDeck = ref(null)
const editingCard = ref(null)
const editingCardIndex = ref(-1)

const deckForm = ref({
  name: '',
  description: '',
  category: 'general',
  difficulty: 'beginner',
  tags: []
})

const cardForm = ref({
  question: '',
  answer: '',
  explanation: '',
  category: '',
  difficulty: 'beginner',
  source: '',
  tags: []
})

const tagsInput = ref('')
const cardTagsInput = ref('')

// 從 store 獲取的數據
const decks = computed(() => flashcardStore.decks)
const hasDecks = computed(() => flashcardStore.hasDecks)
const deckCount = computed(() => flashcardStore.deckCount)
const isLoading = computed(() => flashcardStore.isLoading)

// 計算屬性
const sortedDecks = computed(() => {
  return [...decks.value].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
})

const totalCards = computed(() => {
  return decks.value.reduce((sum, deck) => sum + deck.stats.totalCards, 0)
})

const todayStudied = computed(() => {
  return decks.value.reduce((sum, deck) => sum + deck.stats.studiedToday, 0)
})

const dueCards = computed(() => {
  const now = new Date()
  return decks.value.reduce((sum, deck) => {
    const due = deck.cards.filter(card => {
      if (!card.nextReview) return true
      return new Date(card.nextReview) <= now
    }).length
    return sum + due
  }, 0)
})

// 方法
function getDifficultyText(difficulty) {
  const difficultyMap = {
    'beginner': '初級',
    'intermediate': '中級',
    'advanced': '高級'
  }
  return difficultyMap[difficulty] || '未知'
}

function getRelativeTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))

  if (diffInHours < 1) return '剛剛'
  if (diffInHours < 24) return `${diffInHours}小時前`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}天前`

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks}週前`

  return date.toLocaleDateString('zh-TW')
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function startStudy(deck) {
  emit('start-study', deck)
}

function editDeck(deck) {
  editingDeck.value = deck
  deckForm.value = {
    name: deck.name,
    description: deck.description,
    category: deck.category,
    difficulty: deck.difficulty,
    tags: [...deck.tags]
  }
  tagsInput.value = deck.tags.join(', ')
  showCreateDeck.value = true
}

function deleteDeck(deck) {
  if (confirm(`確定要刪除牌組「${deck.name}」嗎？這個操作無法復原。`)) {
    flashcardStore.deleteDeck(deck.id)
  }
}

function exportDeck(deckId) {
  try {
    flashcardStore.exportDeck(deckId)
  } catch (error) {
    alert('匯出失敗：' + error.message)
  }
}

function closeModal() {
  showCreateDeck.value = false
  editingDeck.value = null
  resetDeckForm()
}

function resetDeckForm() {
  deckForm.value = {
    name: '',
    description: '',
    category: 'general',
    difficulty: 'beginner',
    tags: []
  }
  tagsInput.value = ''
}

function saveDeck() {
  // 處理標籤
  const tags = tagsInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)

  const deckData = {
    ...deckForm.value,
    tags
  }

  if (editingDeck.value) {
    // 更新現有牌組
    Object.assign(editingDeck.value, deckData, {
      updatedAt: new Date().toISOString()
    })
    flashcardStore.saveDecks()
    console.log('✅ 牌組已更新')
  } else {
    // 建立新牌組
    flashcardStore.createDeck(deckData)
  }

  closeModal()
}

function editCard(card, index) {
  editingCard.value = card
  editingCardIndex.value = index
  cardForm.value = {
    question: card.question,
    answer: card.answer,
    explanation: card.explanation,
    category: card.category,
    difficulty: card.difficulty,
    source: card.source,
    tags: [...card.tags]
  }
  cardTagsInput.value = card.tags.join(', ')
  showAddCard.value = true
}

function deleteCard(index) {
  if (confirm('確定要刪除這張卡片嗎？')) {
    editingDeck.value.cards.splice(index, 1)
    editingDeck.value.stats.totalCards = editingDeck.value.cards.length
    editingDeck.value.updatedAt = new Date().toISOString()
    flashcardStore.saveDecks()
  }
}

function closeCardModal() {
  showAddCard.value = false
  editingCard.value = null
  editingCardIndex.value = -1
  resetCardForm()
}

function resetCardForm() {
  cardForm.value = {
    question: '',
    answer: '',
    explanation: '',
    category: '',
    difficulty: 'beginner',
    source: '',
    tags: []
  }
  cardTagsInput.value = ''
}

function saveCard() {
  // 處理標籤
  const tags = cardTagsInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)

  const cardData = {
    ...cardForm.value,
    tags
  }

  if (editingCard.value) {
    // 更新現有卡片
    Object.assign(editingCard.value, cardData, {
      updatedAt: new Date().toISOString()
    })
    editingDeck.value.updatedAt = new Date().toISOString()
    flashcardStore.saveDecks()
    console.log('✅ 卡片已更新')
  } else {
    // 新增卡片
    flashcardStore.addCard(editingDeck.value.id, cardData)
  }

  closeCardModal()
}

async function handleFileImport(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    const fileContent = await readFileAsText(file)
    const importedDeck = flashcardStore.importDeck(fileContent)

    alert(`成功匯入牌組「${importedDeck.name}」，共 ${importedDeck.cards.length} 張卡片`)
    showImportDeck.value = false

    // 清除檔案輸入
    event.target.value = ''
  } catch (error) {
    alert('匯入失敗：' + error.message)
  }
}

// 創建書籤測驗
async function createBookmarkQuiz() {
  try {
    console.log('📚 開始創建書籤測驗...')
    const bookmarkDeck = await flashcardStore.createDeckFromBookmarks()

    if (bookmarkDeck) {
      alert(`🎉 成功創建書籤測驗！

📊 測驗信息：
• 牌組名稱：${bookmarkDeck.name}
• 卡片數量：${bookmarkDeck.cards.length} 張
• 自動分類：法條記憶、大法官解釋、重點整理

💡 提示：
• 測驗會根據您書籤的類型智能生成問題
• 釋字書籤會生成解釋爭點和見解問題
• 法條書籤會生成條文內容和適用情境問題
• 現在可以開始學習了！`)

      console.log('✅ 書籤測驗創建成功:', bookmarkDeck)
    }
  } catch (error) {
    console.error('❌ 創建書籤測驗失敗:', error)
    alert(`創建失敗：${error.message}

💡 建議：
• 請先到「📚 我的書籤」頁面保存一些法律內容
• 支持的書籤類型：大法官解釋、法條、法律文章
• 確保書籤包含足夠的內容信息`)
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(new Error('檔案讀取失敗'))
    reader.readAsText(file, 'UTF-8')
  })
}

// 生命週期
onMounted(async () => {
  console.log('🃏 FlashcardManager mounted')
  try {
    await flashcardStore.loadDecks()
    console.log('🃏 Decks loaded:', flashcardStore.decks.length)
  } catch (error) {
    console.error('❌ Error loading decks:', error)
  }
})
</script>

<style scoped>
.flashcard-manager {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* 標題欄 */
.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.manager-header h2 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.bookmark-quiz-btn, .create-btn, .import-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.bookmark-quiz-btn:hover, .create-btn:hover, .import-btn:hover {
  background: #5a6fd8;
}

.bookmark-quiz-btn {
  background: #ff9800;
}

.bookmark-quiz-btn:hover {
  background: #f57c00;
}

.import-btn {
  background: #4caf50;
}

.import-btn:hover {
  background: #45a049;
}

/* 統計概覽 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 8px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

/* 牌組列表 */
.deck-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.deck-item {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  transition: transform 0.2s ease;
}

.deck-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.deck-info {
  flex: 1;
  padding: 24px;
}

.deck-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.deck-header h3 {
  margin: 0;
  color: #333;
  font-size: 20px;
}

.deck-badges {
  display: flex;
  gap: 8px;
}

.difficulty-badge, .category-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: white;
}

.difficulty-badge.beginner {
  background: #4caf50;
}

.difficulty-badge.intermediate {
  background: #ff9800;
}

.difficulty-badge.advanced {
  background: #f44336;
}

.category-badge {
  background: #9c27b0;
}

.deck-description {
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
}

.deck-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.tag {
  background: #f0f0f0;
  color: #666;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.deck-stats {
  display: flex;
  gap: 24px;
}

.deck-stats .stat {
  text-align: center;
}

.deck-stats .stat-value {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.deck-stats .stat-label {
  font-size: 12px;
  color: #999;
}

.deck-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
  background: #f8f9fa;
  gap: 8px;
  min-width: 120px;
}

.study-btn, .edit-btn, .export-btn, .delete-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s ease;
}

.study-btn {
  background: #667eea;
  color: white;
}

.edit-btn {
  background: #ff9800;
  color: white;
}

.export-btn {
  background: #4caf50;
  color: white;
}

.delete-btn {
  background: #f44336;
  color: white;
}

.study-btn:hover {
  background: #5a6fd8;
}

.edit-btn:hover {
  background: #f57c00;
}

.export-btn:hover {
  background: #45a049;
}

.delete-btn:hover {
  background: #d32f2f;
}

.no-decks {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-decks-content h3 {
  margin-bottom: 12px;
  color: #333;
}

.no-decks-content p {
  color: #666;
  margin-bottom: 24px;
}

.create-first-deck-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

/* 對話框樣式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.card-modal {
  max-width: 500px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 表單樣式 */
.deck-form, .card-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn:hover {
  background: #5a6fd8;
}

/* 卡片管理 */
.card-management {
  border-top: 1px solid #e0e0e0;
  padding: 24px;
}

.card-management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-management-header h4 {
  margin: 0;
  color: #333;
}

.add-card-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.card-item {
  display: flex;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  align-items: center;
  gap: 12px;
}

.card-preview {
  flex: 1;
}

.card-question, .card-answer {
  font-size: 13px;
  margin-bottom: 4px;
}

.card-question {
  color: #333;
}

.card-answer {
  color: #666;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.card-category {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
}

.card-difficulty {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  color: white;
}

.card-difficulty.beginner {
  background: #4caf50;
}

.card-difficulty.intermediate {
  background: #ff9800;
}

.card-difficulty.advanced {
  background: #f44336;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.edit-card-btn, .delete-card-btn {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-card-btn:hover {
  background: #e0e0e0;
}

.delete-card-btn:hover {
  background: #ffebee;
}

/* 匯入對話框 */
.import-content {
  padding: 24px;
}

.file-input {
  width: 100%;
  margin-bottom: 20px;
}

.import-hint {
  background: #f0f8ff;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.import-hint p {
  margin: 0 0 8px 0;
  color: #1976d2;
  font-weight: 500;
}

.import-hint ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
}

.import-hint li {
  margin-bottom: 4px;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .flashcard-manager {
    padding: 16px;
  }

  .manager-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .header-actions {
    justify-content: center;
  }

  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }

  .deck-item {
    flex-direction: column;
  }

  .deck-actions {
    flex-direction: row;
    min-width: auto;
    justify-content: space-around;
  }

  .deck-stats {
    flex-wrap: wrap;
    gap: 12px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal-content {
    width: 95%;
    margin: 20px;
  }
}
</style>