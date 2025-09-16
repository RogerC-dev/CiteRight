<template>
  <div class="study-session">
    <!-- 學習會話未開始 -->
    <div v-if="!studySession" class="session-selector">
      <h2>📚 選擇學習牌組</h2>

      <div v-if="hasDecks" class="deck-grid">
        <div
          v-for="deck in decks"
          :key="deck.id"
          :class="['deck-card', { selected: selectedDeck?.id === deck.id }]"
          @click="selectDeck(deck)"
        >
          <div class="deck-header">
            <h3>{{ deck.name }}</h3>
            <span :class="['deck-difficulty', deck.difficulty]">
              {{ getDifficultyText(deck.difficulty) }}
            </span>
          </div>

          <p class="deck-description">{{ deck.description }}</p>

          <div class="deck-stats">
            <div class="stat">
              <span class="stat-label">卡片數量</span>
              <span class="stat-value">{{ deck.stats.totalCards }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">今日已學</span>
              <span class="stat-value">{{ deck.stats.studiedToday }}</span>
            </div>
            <div class="stat" v-if="deck.stats.averageScore > 0">
              <span class="stat-label">平均分數</span>
              <span class="stat-value">{{ Math.round(deck.stats.averageScore * 100 / 3) }}%</span>
            </div>
          </div>

          <div class="deck-tags">
            <span v-for="tag in deck.tags" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div v-else class="no-decks">
        <p>還沒有任何牌組，請先建立一個牌組</p>
        <button @click="$emit('create-deck')" class="create-deck-btn">
          ➕ 建立新牌組
        </button>
      </div>

      <!-- 學習選項 -->
      <div v-if="selectedDeck" class="study-options">
        <h3>學習選項</h3>

        <div class="option-group">
          <label class="option-label">
            <input
              type="checkbox"
              v-model="studyOptions.shuffleCards"
            >
            隨機排序卡片
          </label>

          <label class="option-label">
            <input
              type="checkbox"
              v-model="studyOptions.reviewMode"
            >
            復習模式 (只顯示需要復習的卡片)
          </label>

          <label class="option-label">
            學習數量限制:
            <select v-model="studyOptions.cardLimit">
              <option :value="null">全部</option>
              <option :value="10">10張</option>
              <option :value="20">20張</option>
              <option :value="50">50張</option>
            </select>
          </label>
        </div>

        <button
          @click="startSession"
          class="start-study-btn"
          :disabled="!selectedDeck || selectedDeck.stats.totalCards === 0"
        >
          🎓 開始學習
        </button>
      </div>
    </div>

    <!-- 學習會話進行中 -->
    <div v-else-if="currentCard" class="active-session">
      <!-- 會話信息欄 -->
      <div class="session-info">
        <div class="session-header">
          <h2>{{ studySession.deckName }}</h2>
          <button @click="endSession" class="end-session-btn" title="結束學習">
            ❌ 結束
          </button>
        </div>

        <div class="session-stats">
          <div class="stat">
            <span class="stat-label">進度</span>
            <span class="stat-value">{{ studySession.completed }}/{{ studySession.total }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">準確率</span>
            <span class="stat-value">{{ getAccuracyRate() }}%</span>
          </div>
          <div class="stat">
            <span class="stat-label">學習時間</span>
            <span class="stat-value">{{ getElapsedTime() }}</span>
          </div>
        </div>
      </div>

      <!-- 卡片組件 -->
      <FlashcardComponent
        ref="flashcardRef"
        :card="currentCard"
        :card-number="studySession.currentIndex + 1"
        :total-cards="studySession.total"
        @answer="handleAnswer"
        @flip="handleFlip"
      />

      <!-- 快捷鍵提示 -->
      <div class="keyboard-hints">
        <p>鍵盤快捷鍵: <kbd>Space</kbd> 翻卡, <kbd>1</kbd> 重來, <kbd>2</kbd> 困難, <kbd>3</kbd> 良好, <kbd>4</kbd> 簡單</p>
      </div>
    </div>

    <!-- 會話結束 -->
    <div v-else class="session-complete">
      <div class="completion-banner">
        <h2>🎉 學習完成！</h2>
        <p>恭喜你完成了這次的學習會話</p>
      </div>

      <div class="session-summary">
        <h3>學習總結</h3>
        <div class="summary-stats">
          <div class="summary-stat">
            <div class="stat-number">{{ lastSession?.completed || 0 }}</div>
            <div class="stat-label">已學習卡片</div>
          </div>
          <div class="summary-stat">
            <div class="stat-number">{{ getSessionAccuracy() }}%</div>
            <div class="stat-label">總準確率</div>
          </div>
          <div class="summary-stat">
            <div class="stat-number">{{ getSessionDuration() }}</div>
            <div class="stat-label">學習時間</div>
          </div>
        </div>

        <div class="difficulty-breakdown">
          <h4>難度分布</h4>
          <div class="breakdown-bars">
            <div class="breakdown-item">
              <span class="breakdown-label">重來</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill again" :style="{ width: `${getDifficultyPercentage('again')}%` }"></div>
              </div>
              <span class="breakdown-count">{{ getDifficultyCount('again') }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">困難</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill hard" :style="{ width: `${getDifficultyPercentage('hard')}%` }"></div>
              </div>
              <span class="breakdown-count">{{ getDifficultyCount('hard') }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">良好</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill good" :style="{ width: `${getDifficultyPercentage('good')}%` }"></div>
              </div>
              <span class="breakdown-count">{{ getDifficultyCount('good') }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">簡單</span>
              <div class="breakdown-bar">
                <div class="breakdown-fill easy" :style="{ width: `${getDifficultyPercentage('easy')}%` }"></div>
              </div>
              <span class="breakdown-count">{{ getDifficultyCount('easy') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="session-actions">
        <button @click="restartSession" class="restart-btn">
          🔄 重新學習
        </button>
        <button @click="selectNewDeck" class="new-deck-btn">
          📚 選擇其他牌組
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFlashcardStore } from '../../stores/flashcard'
import FlashcardComponent from './FlashcardComponent.vue'

// Store
const flashcardStore = useFlashcardStore()

// Emit
const emit = defineEmits(['create-deck'])

// 響應式數據
const selectedDeck = ref(null)
const studyOptions = ref({
  shuffleCards: false,
  reviewMode: false,
  cardLimit: null
})
const lastSession = ref(null)
const sessionStartTime = ref(null)

// 從 store 獲取的計算屬性
const decks = computed(() => flashcardStore.decks)
const hasDecks = computed(() => flashcardStore.hasDecks)
const studySession = computed(() => flashcardStore.studySession)
const currentCard = computed(() => flashcardStore.currentCard)
const isLoading = computed(() => flashcardStore.isLoading)

// 計算屬性
const currentDeck = computed(() => flashcardStore.currentDeck)

// 組件 ref
const flashcardRef = ref(null)

// 方法
function selectDeck(deck) {
  selectedDeck.value = deck
}

function startSession() {
  if (!selectedDeck.value) return

  sessionStartTime.value = new Date()

  const success = flashcardStore.startStudySession(selectedDeck.value.id, studyOptions.value)
  if (success) {
    console.log('🎓 學習會話已開始')
  } else {
    console.error('❌ 無法開始學習會話')
  }
}

function handleAnswer(answerData) {
  const success = flashcardStore.answerCard(answerData.difficulty)
  if (success && flashcardRef.value) {
    // 重置卡片狀態準備下一張
    setTimeout(() => {
      flashcardRef.value?.resetCard()
    }, 100)
  }
}

function handleFlip(isFlipped) {
  // 卡片翻面時的處理
  console.log('卡片已翻面:', isFlipped)
}

function endSession() {
  if (studySession.value) {
    lastSession.value = { ...studySession.value }
  }
  flashcardStore.endStudySession()
}

function restartSession() {
  if (selectedDeck.value) {
    startSession()
  }
}

function selectNewDeck() {
  selectedDeck.value = null
  lastSession.value = null
}

function getDifficultyText(difficulty) {
  const difficultyMap = {
    'beginner': '初級',
    'intermediate': '中級',
    'advanced': '高級'
  }
  return difficultyMap[difficulty] || '未知'
}

function getAccuracyRate() {
  if (!studySession.value || !studySession.value.scores || studySession.value.scores.length === 0) return 0

  const goodAnswers = studySession.value.scores.filter(s =>
    s.difficulty === 'good' || s.difficulty === 'easy'
  ).length

  return Math.round((goodAnswers / studySession.value.scores.length) * 100)
}

function getElapsedTime() {
  if (!studySession.value || !sessionStartTime.value) return '00:00'

  const now = new Date()
  const elapsed = Math.floor((now - sessionStartTime.value) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function getSessionAccuracy() {
  if (!lastSession.value || lastSession.value.scores.length === 0) return 0

  const goodAnswers = lastSession.value.scores.filter(s =>
    s.difficulty === 'good' || s.difficulty === 'easy'
  ).length

  return Math.round((goodAnswers / lastSession.value.scores.length) * 100)
}

function getSessionDuration() {
  if (!lastSession.value) return '00:00'

  const duration = Math.floor((new Date() - new Date(lastSession.value.startTime)) / 1000)
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function getDifficultyCount(difficulty) {
  if (!lastSession.value) return 0
  return lastSession.value.scores.filter(s => s.difficulty === difficulty).length
}

function getDifficultyPercentage(difficulty) {
  if (!lastSession.value || lastSession.value.scores.length === 0) return 0
  const count = getDifficultyCount(difficulty)
  return (count / lastSession.value.scores.length) * 100
}

// 鍵盤快捷鍵
function handleKeydown(event) {
  if (!studySession.value || !currentCard.value) return

  switch (event.key) {
    case ' ': // 空格鍵翻卡
      event.preventDefault()
      if (flashcardRef.value) {
        flashcardRef.value.flip()
      }
      break
    case '1': // 重來
      event.preventDefault()
      handleAnswer({ difficulty: 'again' })
      break
    case '2': // 困難
      event.preventDefault()
      handleAnswer({ difficulty: 'hard' })
      break
    case '3': // 良好
      event.preventDefault()
      handleAnswer({ difficulty: 'good' })
      break
    case '4': // 簡單
      event.preventDefault()
      handleAnswer({ difficulty: 'easy' })
      break
  }
}

// 生命週期
onMounted(async () => {
  await flashcardStore.loadDecks()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.study-session {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

/* 會話選擇器 */
.session-selector {
  text-align: center;
}

.session-selector h2 {
  margin-bottom: 30px;
  color: #333;
}

.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.deck-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.deck-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.deck-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.deck-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.deck-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.deck-difficulty {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: white;
}

.deck-difficulty.beginner {
  background: #4caf50;
}

.deck-difficulty.intermediate {
  background: #ff9800;
}

.deck-difficulty.advanced {
  background: #f44336;
}

.deck-description {
  color: #666;
  margin-bottom: 16px;
  text-align: left;
}

.deck-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.stat-value {
  font-weight: 600;
  color: #333;
}

.deck-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: #f0f0f0;
  color: #666;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.no-decks {
  text-align: center;
  padding: 40px;
  color: #666;
}

.create-deck-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 16px;
}

.study-options {
  background: #f8f9fa;
  padding: 24px;
  border-radius: 12px;
  text-align: left;
}

.study-options h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #555;
}

.option-label input[type="checkbox"] {
  margin-right: 8px;
}

.option-label select {
  margin-left: 8px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.start-study-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: transform 0.2s ease;
}

.start-study-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.start-study-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 活動會話 */
.active-session {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.session-info {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.session-header h2 {
  margin: 0;
  color: #333;
}

.end-session-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.session-stats {
  display: flex;
  justify-content: space-around;
}

.session-stats .stat {
  text-align: center;
}

.keyboard-hints {
  text-align: center;
  margin-top: 16px;
  color: #666;
  font-size: 14px;
}

.keyboard-hints kbd {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* 會話完成 */
.session-complete {
  text-align: center;
}

.completion-banner {
  margin-bottom: 30px;
}

.completion-banner h2 {
  color: #4caf50;
  margin-bottom: 8px;
}

.session-summary {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  text-align: left;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.summary-stat {
  text-align: center;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 4px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.difficulty-breakdown h4 {
  margin-bottom: 16px;
  color: #333;
}

.breakdown-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakdown-item {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: center;
  gap: 12px;
}

.breakdown-label {
  font-size: 14px;
  color: #666;
}

.breakdown-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.breakdown-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.breakdown-fill.again {
  background: #f44336;
}

.breakdown-fill.hard {
  background: #ff9800;
}

.breakdown-fill.good {
  background: #4caf50;
}

.breakdown-fill.easy {
  background: #2196f3;
}

.breakdown-count {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.session-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.restart-btn, .new-deck-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.restart-btn {
  background: #667eea;
  color: white;
}

.new-deck-btn {
  background: #4caf50;
  color: white;
}

.restart-btn:hover, .new-deck-btn:hover {
  transform: translateY(-2px);
}

/* 響應式設計 */
@media (max-width: 768px) {
  .study-session {
    padding: 16px;
  }

  .deck-grid {
    grid-template-columns: 1fr;
  }

  .summary-stats {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .session-actions {
    flex-direction: column;
  }

  .breakdown-item {
    grid-template-columns: 50px 1fr auto;
    gap: 8px;
  }
}
</style>