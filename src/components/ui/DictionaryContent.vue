<template>
  <div class="dictionary-container">
    <!-- Search Section -->
    <div class="dictionary-search-container">
      <h3 class="search-title">
        <i class="bi bi-search"></i> 法規智慧搜尋
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
        <i class="bi bi-lightbulb"></i> <strong>搜尋提示：</strong>您可以搜尋完整法規名稱如「民法」，或使用關鍵字組合如「勞動基準法 加班」、「刑法 詐欺」來精準定位相關條文。
      </div>
    </div>

    <!-- Quick Access Panel -->
    <div class="quick-access-panel">
      <div class="quick-access-title"><i class="bi bi-lightning-charge"></i> 快速查詢</div>
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
          <i :class="category.icon || 'bi bi-file-earmark-text'"></i> {{ category.title }}
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
  background: var(--cr-surface-muted);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid var(--cr-border);
}

.search-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--cr-primary);
  font-weight: 600;
}

.dictionary-search-box {
  position: relative;
  margin-bottom: 12px;
}

.dictionary-search-input {
  width: 100%;
  padding: 12px 48px 12px 16px;
  border: 2px solid var(--cr-primary);
  border-radius: 8px;
  font-size: 14px;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  transition: all 0.3s;
  box-sizing: border-box;
  background: var(--cr-surface);
  color: var(--cr-text-primary);
}

.dictionary-search-input:focus {
  outline: none;
  border-color: var(--cr-primary-hover);
  box-shadow: 0 0 0 3px var(--cr-primary-soft);
}

.dictionary-search-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--cr-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dictionary-search-btn:hover:not(:disabled) {
  background: var(--cr-primary-hover);
}

.dictionary-search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-hint {
  font-size: 12px;
  color: var(--cr-text-secondary);
  line-height: 1.6;
  background: var(--cr-surface);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
}

/* Quick Access Panel */
.quick-access-panel {
  background: var(--cr-surface-muted);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid var(--cr-border);
}

.quick-access-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cr-warning);
  margin-bottom: 8px;
}

.recent-searches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recent-search-tag {
  padding: 4px 8px;
  background: var(--cr-surface);
  border: 1px solid var(--cr-warning);
  border-radius: 12px;
  font-size: 12px;
  color: var(--cr-warning);
  cursor: pointer;
  transition: all 0.2s;
}

.recent-search-tag:hover {
  background: var(--cr-surface-muted);
  transform: translateY(-1px);
}

/* Search Results */
.search-results {
  margin-bottom: 16px;
}

.results-header {
  background: var(--cr-surface-muted);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--cr-border);
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-title {
  color: var(--cr-primary);
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.clear-results-btn {
  padding: 4px 8px;
  background: var(--cr-surface);
  border: 1px solid var(--cr-border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--cr-text-secondary);
}

.clear-results-btn:hover {
  border-color: var(--cr-primary);
  color: var(--cr-primary);
}

.result-item {
  background: var(--cr-surface);
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--cr-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: var(--cr-primary);
  background: var(--cr-primary-soft);
  transform: translateY(-1px);
}

.result-title {
  font-weight: 600;
  color: var(--cr-primary);
  margin-bottom: 4px;
  font-size: 14px;
}

.result-preview {
  font-size: 13px;
  color: var(--cr-text-secondary);
  line-height: 1.5;
  margin-bottom: 4px;
}

.result-source {
  font-size: 11px;
  color: var(--cr-text-secondary);
  opacity: 0.8;
}

/* Law Categories */
.law-categories {
  display: grid;
  gap: 12px;
}

.category-section {
  background: var(--cr-surface);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--cr-border);
  transition: all 0.2s;
}

.category-section:hover {
  border-color: var(--cr-primary);
  background: var(--cr-primary-soft);
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cr-primary);
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
  background: var(--cr-surface);
  border: 1px solid var(--cr-border);
  border-radius: 4px;
  color: var(--cr-text-primary);
  text-decoration: none;
  font-size: 13px;
  transition: all 0.2s;
  cursor: pointer;
}

.law-link:hover {
  border-color: var(--cr-primary);
  color: var(--cr-primary);
  background: var(--cr-primary-soft);
  transform: translateY(-1px);
}

/* Scrollbar styling */
.dictionary-container::-webkit-scrollbar {
  width: 6px;
}

.dictionary-container::-webkit-scrollbar-track {
  background: var(--cr-surface-muted);
  border-radius: 3px;
}

.dictionary-container::-webkit-scrollbar-thumb {
  background: var(--cr-text-secondary);
  border-radius: 3px;
  opacity: 0.5;
}

.dictionary-container::-webkit-scrollbar-thumb:hover {
  background: var(--cr-text-primary);
  opacity: 0.7;
}
</style>