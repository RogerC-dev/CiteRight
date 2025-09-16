<template>
  <div class="flashcard-container">
    <!-- 卡片本體 -->
    <div
      :class="['flashcard', { flipped: isFlipped }]"
      @click="handleCardClick"
    >
      <!-- 正面 (問題) -->
      <div class="card-face card-front">
        <div class="card-header">
          <div class="card-meta">
            <span class="card-category">{{ card.category }}</span>
            <span :class="['card-difficulty', card.difficulty]">
              {{ getDifficultyText(card.difficulty) }}
            </span>
          </div>
          <div class="card-number">{{ cardNumber }}/{{ totalCards }}</div>
        </div>

        <div class="card-content">
          <div class="question-icon">❓</div>
          <h3 class="question-text">{{ card.question }}</h3>
        </div>

        <div class="card-footer">
          <div class="card-tags">
            <span
              v-for="tag in card.tags"
              :key="tag"
              class="tag"
            >
              {{ tag }}
            </span>
          </div>
          <div class="flip-hint">點擊翻面</div>
        </div>
      </div>

      <!-- 背面 (答案) -->
      <div class="card-face card-back">
        <div class="card-header">
          <div class="card-meta">
            <span class="card-source">{{ card.source }}</span>
          </div>
          <div class="card-number">{{ cardNumber }}/{{ totalCards }}</div>
        </div>

        <div class="card-content">
          <div class="answer-icon">✅</div>
          <h3 class="answer-text">{{ card.answer }}</h3>

          <div v-if="card.explanation" class="explanation">
            <h4>解釋說明：</h4>
            <p>{{ card.explanation }}</p>
          </div>
        </div>

        <div class="card-footer">
          <div class="difficulty-buttons">
            <button
              @click.stop="handleDifficulty('again')"
              class="difficulty-btn again"
              title="重來 - 需要再次學習"
            >
              🔄 重來
            </button>
            <button
              @click.stop="handleDifficulty('hard')"
              class="difficulty-btn hard"
              title="困難 - 有些困難"
            >
              😰 困難
            </button>
            <button
              @click.stop="handleDifficulty('good')"
              class="difficulty-btn good"
              title="良好 - 記得答案"
            >
              👍 良好
            </button>
            <button
              @click.stop="handleDifficulty('easy')"
              class="difficulty-btn easy"
              title="簡單 - 很容易"
            >
              😊 簡單
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 進度條 -->
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{ width: `${progress}%` }"
      ></div>
      <div class="progress-text">
        進度: {{ cardNumber }}/{{ totalCards }} ({{ Math.round(progress) }}%)
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  cardNumber: {
    type: Number,
    default: 1
  },
  totalCards: {
    type: Number,
    default: 1
  }
})

// Emits
const emit = defineEmits(['answer', 'flip'])

// 響應式數據
const isFlipped = ref(false)

// 計算屬性
const progress = computed(() => {
  return props.totalCards > 0 ? (props.cardNumber / props.totalCards) * 100 : 0
})

// 方法
function handleCardClick() {
  if (!isFlipped.value) {
    isFlipped.value = true
    emit('flip', true)
  }
}

function handleDifficulty(difficulty) {
  emit('answer', {
    cardId: props.card.id,
    difficulty,
    timestamp: new Date()
  })

  // 重置卡片狀態準備下一張
  setTimeout(() => {
    isFlipped.value = false
  }, 500)
}

function getDifficultyText(difficulty) {
  const difficultyMap = {
    'beginner': '初級',
    'intermediate': '中級',
    'advanced': '高級'
  }
  return difficultyMap[difficulty] || '未知'
}

// 重置卡片狀態 (當卡片改變時)
function resetCard() {
  isFlipped.value = false
}

// 對外暴露方法
defineExpose({
  resetCard,
  flip: () => { isFlipped.value = !isFlipped.value }
})
</script>

<style scoped>
.flashcard-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  perspective: 1000px;
}

.flashcard {
  position: relative;
  width: 100%;
  height: 400px;
  transform-style: preserve-3d;
  transition: transform 0.6s ease-in-out;
  cursor: pointer;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.flashcard.flipped {
  transform: rotateY(180deg);
  cursor: default;
}

.card-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
}

.card-front {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.card-back {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  transform: rotateY(180deg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-category {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.card-difficulty {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.card-difficulty.beginner {
  background: rgba(76, 175, 80, 0.3);
}

.card-difficulty.intermediate {
  background: rgba(255, 193, 7, 0.3);
}

.card-difficulty.advanced {
  background: rgba(244, 67, 54, 0.3);
}

.card-source {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.card-number {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
}

.question-icon, .answer-icon {
  font-size: 48px;
  opacity: 0.8;
}

.question-text, .answer-text {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
}

.explanation {
  margin-top: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  text-align: left;
  max-width: 100%;
}

.explanation h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.explanation p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.card-footer {
  margin-top: auto;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.flip-hint {
  text-align: center;
  font-size: 12px;
  opacity: 0.7;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.difficulty-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.difficulty-btn {
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.difficulty-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.difficulty-btn.again {
  background: #f44336;
}

.difficulty-btn.hard {
  background: #ff9800;
}

.difficulty-btn.good {
  background: #4caf50;
}

.difficulty-btn.easy {
  background: #2196f3;
}

.progress-bar {
  margin-top: 20px;
  position: relative;
  height: 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50 0%, #2196f3 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .flashcard {
    height: 350px;
  }

  .card-face {
    padding: 20px;
  }

  .question-text, .answer-text {
    font-size: 18px;
  }

  .question-icon, .answer-icon {
    font-size: 36px;
  }

  .difficulty-buttons {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .difficulty-btn {
    padding: 10px 14px;
    font-size: 13px;
  }
}
</style>