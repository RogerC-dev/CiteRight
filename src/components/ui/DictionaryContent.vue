<template>
  <div class="dictionary-container">
    <!-- Search Section -->
    <div class="dictionary-search-container">
      <h3 class="search-title">
        🔍 法規智慧搜尋
      </h3>
      <div class="dictionary-search-box">
        <input
          v-model="searchQuery"
          type="text"
          class="dictionary-search-input"
          placeholder="輸入法規名稱或條文關鍵字..."
          @keypress.enter="performSearch"
          @input="onSearchInput"
        />
        <button
          class="dictionary-search-btn"
          :disabled="isSearching"
          @click="performSearch"
        >
          {{ isSearching ? '搜尋中...' : '搜尋' }}
        </button>
      </div>
      <div class="search-hint">
        💡 <strong>搜尋提示：</strong>您可以搜尋完整法規名稱如「民法」，或使用關鍵字組合如「勞動基準法 加班」、「刑法 詐欺」來精準定位相關條文。
      </div>
    </div>

    <!-- Quick Access Panel -->
    <div class="quick-access-panel">
      <div class="quick-access-title">⚡ 快速查詢</div>
      <div class="recent-searches">
        <span
          v-for="term in recentSearches"
          :key="term"
          class="recent-search-tag"
          @click="searchFromTag(term)"
        >
          {{ term }}
        </span>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchResults.length > 0" class="search-results">
      <div class="results-header">
        <h3 class="results-title">搜尋結果 ({{ searchResults.length }} 筆)</h3>
        <button class="clear-results-btn" @click="clearResults">清除結果</button>
      </div>
      <div
        v-for="result in searchResults"
        :key="`${result.lawName}-${result.article}`"
        class="result-item"
        @click="selectResult(result)"
      >
        <div class="result-title">{{ result.title }}</div>
        <div class="result-preview">{{ result.preview }}</div>
        <div class="result-source">來源：{{ result.source }}</div>
      </div>
    </div>

    <!-- Law Categories -->
    <div class="law-categories">
      <div
        v-for="category in lawCategories"
        :key="category.title"
        class="category-section"
      >
        <div class="category-title">
          {{ category.title }}
        </div>
        <div class="law-links">
          <a
            v-for="law in category.laws"
            :key="law"
            class="law-link"
            @click="loadLaw(law)"
          >
            {{ law }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDictionaryStore } from '@/stores/dictionary'
import { storeToRefs } from 'pinia'

// Store
const dictionaryStore = useDictionaryStore()
const { 
  searchQuery, 
  searchResults, 
  recentSearches, 
  isSearching,
  lawCategories 
} = storeToRefs(dictionaryStore)

// Emits
const emit = defineEmits(['result-selected', 'law-loaded'])

// Methods
const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    console.warn('請輸入搜尋關鍵字')
    return
  }
  
  try {
    await dictionaryStore.searchLaws(searchQuery.value)
    dictionaryStore.addToRecentSearches(searchQuery.value)
  } catch (error) {
    console.error('搜尋失敗:', error)
  }
}

const searchFromTag = (term) => {
  searchQuery.value = term
  performSearch()
}

const clearResults = () => {
  dictionaryStore.clearSearchResults()
}

const selectResult = (result) => {
  console.log('📖 選中結果:', result)
  emit('result-selected', result)
}

const loadLaw = (lawName) => {
  console.log('📚 載入法規:', lawName)
  searchQuery.value = lawName
  
  dictionaryStore.fetchLawContent(lawName)
    .then((content) => {
      emit('law-loaded', { lawName, content })
    })
    .catch((error) => {
      console.error('載入法規失敗:', error)
    })
}

// Search input debouncing
let searchTimeout
const onSearchInput = (e) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (e.target.value.length > 1) {
      // Show suggestions logic can be added here
      console.log('顯示搜尋建議:', e.target.value)
    }
  }, 300)
}

// Lifecycle
onMounted(() => {
  console.log('📖 Dictionary組件已掛載')
  dictionaryStore.loadRecentSearches()
})
</script>

<style scoped>
.dictionary-container {
  height: 100%;
  overflow-y: auto;
}

/* Search Section */
.dictionary-search-container {
  background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid #91d5ff;
}

.search-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #096dd9;
  font-weight: 600;
}

.dictionary-search-box {
  position: relative;
  margin-bottom: 12px;
}

.dictionary-search-input {
  width: 100%;
  padding: 12px 48px 12px 16px;
  border: 2px solid #1890ff;
  border-radius: 8px;
  font-size: 14px;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  transition: all 0.3s;
  box-sizing: border-box;
}

.dictionary-search-input:focus {
  outline: none;
  border-color: #096dd9;
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

.dictionary-search-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: #1890ff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dictionary-search-btn:hover:not(:disabled) {
  background: #096dd9;
}

.dictionary-search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-hint {
  font-size: 12px;
  color: #666;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
}

/* Quick Access Panel */
.quick-access-panel {
  background: linear-gradient(135deg, #fff7e6, #fffbe6);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid #ffd591;
}

.quick-access-title {
  font-size: 13px;
  font-weight: 600;
  color: #fa8c16;
  margin-bottom: 8px;
}

.recent-searches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recent-search-tag {
  padding: 4px 8px;
  background: white;
  border: 1px solid #ffd591;
  border-radius: 12px;
  font-size: 12px;
  color: #fa8c16;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-search-tag:hover {
  background: #fff7e6;
  transform: translateY(-1px);
}

/* Search Results */
.search-results {
  margin-bottom: 16px;
}

.results-header {
  background: #f0f9ff;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #91d5ff;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-title {
  color: #1890ff;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.clear-results-btn {
  padding: 4px 8px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-results-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.result-item {
  background: white;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: #1890ff;
  background: #f0f9ff;
  transform: translateY(-1px);
}

.result-title {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 4px;
  font-size: 14px;
}

.result-preview {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 4px;
}

.result-source {
  font-size: 11px;
  color: #999;
}

/* Law Categories */
.law-categories {
  display: grid;
  gap: 12px;
}

.category-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  transition: all 0.2s;
}

.category-section:hover {
  border-color: #1890ff;
  background: #f0f9ff;
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.law-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.law-link {
  padding: 6px 12px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  color: #333;
  text-decoration: none;
  font-size: 13px;
  transition: all 0.2s;
  cursor: pointer;
}

.law-link:hover {
  border-color: #1890ff;
  color: #1890ff;
  background: #f0f9ff;
  transform: translateY(-1px);
}

/* Scrollbar styling */
.dictionary-container::-webkit-scrollbar {
  width: 6px;
}

.dictionary-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.dictionary-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.dictionary-container::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>