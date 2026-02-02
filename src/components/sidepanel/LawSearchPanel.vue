<template>
  <div class="law-search-panel">
    <!-- Search Section -->
    <div class="search-section">
      <div class="search-box">
        <i class="bi bi-search search-icon"></i>
        <input 
          v-model="searchQuery"
          type="text" 
          class="search-input"
          placeholder="搜尋法規名稱或關鍵字..."
          @keypress.enter="performSearch"
        >
        <button 
          class="btn-search" 
          :disabled="isSearching"
          @click="performSearch"
        >
          {{ isSearching ? '...' : '搜尋' }}
        </button>
      </div>
      <div v-if="!hasSearchResults" class="search-hint">
        <i class="bi bi-lightbulb-fill"></i> 提示：試試「民法」、「勞基法 加班」
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Loading State -->
      <div v-if="isSearching" class="loading-state">
        <div class="spinner"></div>
        <span>正在搜尋...</span>
      </div>

      <!-- Content View (Single Law/Result) -->
      <div v-else-if="viewMode === 'content' && selectedLaw" class="law-content-view">
        <div class="content-header">
           <button class="btn-back" @click="goBack">
             <i class="bi bi-arrow-left"></i>
           </button>
           <h3>{{ selectedLaw.title }}</h3>
        </div>
        <div class="article-content">
           <!-- Placeholder for actual law content rendering -->
           <div v-if="selectedLaw.chapters && selectedLaw.chapters.length > 0">
              <div v-for="(chapter, idx) in selectedLaw.chapters" :key="idx" class="law-chapter">
                 <h4>{{ chapter.name }}</h4>
                 <div v-for="article in chapter.articles" :key="article.number" class="law-article">
                    <span class="article-no">{{ article.number }}</span>
                    <p>{{ article.content }}</p>
                 </div>
              </div>
           </div>
           <div v-else class="simple-content">
             {{ selectedLaw.preview }}
             <button v-if="selectedLaw.officialUrl" class="btn-external" @click="openExternal(selectedLaw.officialUrl)">
               開啟完整條文 <i class="bi bi-box-arrow-up-right"></i>
             </button>
           </div>
        </div>
      </div>

      <!-- Search Results -->
      <div v-else-if="hasSearchResults && viewMode === 'list'" class="results-list">
        <div class="results-header">
          <span class="count">找到 {{ searchResults.length }} 筆結果</span>
          <button class="btn-clear" @click="clearResults">
            <i class="bi bi-x-circle"></i> 清除
          </button>
        </div>

        <div 
          v-for="(result, index) in searchResults" 
          :key="index"
          class="result-card"
          @click="openLawContent(result)"
        >
          <div class="result-title">{{ result.title }}</div>
          <div class="result-preview">{{ result.preview }}</div>
          <div class="result-meta">
            <span class="source-badge">{{ result.source }}</span>
          </div>
        </div>
      </div>

      <!-- Default View: Categories & Recent -->
      <div v-else class="default-view">
        
        <!-- Recent Searches -->
        <div v-if="recentSearchesDisplay.length > 0" class="section">
          <h4 class="section-title"><i class="bi bi-clock-history"></i> 最近搜尋</h4>
          <div class="tags-cloud">
            <button 
              v-for="term in recentSearchesDisplay" 
              :key="term"
              class="tag"
              @click="searchAndOpen(term)"
            >
              {{ term }}
            </button>
          </div>
        </div>

        <!-- Law Categories -->
        <div class="section">
          <h4 class="section-title"><i class="bi bi-grid-fill"></i> 法規分類</h4>
          <div class="categories-grid">
            <div 
              v-for="cat in lawCategories" 
              :key="cat.title"
              class="category-card"
            >
              <div class="cat-header">
                <i :class="cat.icon"></i>
                <span>{{ cat.title }}</span>
              </div>
              <div class="cat-links">
                <button 
                  v-for="law in cat.laws" 
                  :key="law"
                  class="law-link"
                  @click="fetchAndOpen(law)"
                >
                  {{ law }}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'
import { storeToRefs } from 'pinia'

const store = useDictionaryStore()
const { 
  searchQuery, 
  searchResults, 
  recentSearchesDisplay, 
  isSearching,
  hasSearchResults,
  lawCategories 
} = storeToRefs(store)

const viewMode = ref('list') // 'list' or 'content'
const selectedLaw = ref(null)

function performSearch() {
  if (searchQuery.value.trim()) {
    viewMode.value = 'list'
    store.searchLaws(searchQuery.value)
    store.addToRecentSearches(searchQuery.value)
  }
}

function searchAndOpen(term) {
  searchQuery.value = term
  performSearch()
}

function clearResults() {
  store.clearSearchResults()
  viewMode.value = 'list'
}

async function fetchAndOpen(lawName) {
  // Directly fetch and show content
  searchQuery.value = lawName
  try {
     const data = await store.fetchLawContent(lawName)
     openLawContent(data)
  } catch (e) {
     console.error('Failed to fetch law:', e)
     // Fallback to search if direct fetch fails
     performSearch()
  }
}

function openLawContent(lawData) {
  if (!lawData) return
  selectedLaw.value = lawData
  viewMode.value = 'content'
}

function goBack() {
  viewMode.value = 'list'
  selectedLaw.value = null
}

function openExternal(url) {
  window.open(url, '_blank')
}

onMounted(() => {
  store.loadRecentSearches()
})
</script>

<style scoped>
.law-search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page);
}

.search-section {
  padding: 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
}

.search-icon {
  padding: 0 12px;
  color: var(--text-secondary);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}

.btn-search {
  background: var(--primary);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-search:disabled {
  opacity: 0.6;
}

.search-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-hint i {
  color: var(--warning);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-secondary);
  gap: 12px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--surface-muted);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Results */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-clear {
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.result-title {
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 6px;
  font-size: 15px;
}

.result-preview {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.source-badge {
  font-size: 11px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Default View */
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: var(--surface);
  border: 1px solid var(--primary-soft);
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.tag:hover {
  background: var(--primary);
  color: white;
}

/* Categories Grid */
.categories-grid {
  display: grid;
  gap: 12px;
}

.category-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.cat-header {
  padding: 10px 12px;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.cat-links {
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.law-link, .law-link-more {
  border: none;
  background: var(--bg-page);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.law-link:hover {
  color: var(--primary);
  background: var(--primary-soft);
}

.law-link-more {
  color: var(--text-secondary);
  opacity: 0.7;
}
/* Content View */
.law-content-view {
  background: var(--surface);
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-header {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-muted);
}

.content-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-back {
  border: none;
  background: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
}

.btn-back:hover {
  color: var(--primary);
}

.article-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.law-chapter {
  margin-bottom: 24px;
}

.law-chapter h4 {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 600;
  border-left: 3px solid var(--primary);
  padding-left: 8px;
}

.law-article {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.article-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  min-width: 60px;
}

.law-article p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.btn-external {
  margin-top: 16px;
  color: var(--primary);
  background: none;
  border: 1px solid var(--primary);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-external:hover {
  background: var(--primary-soft);
}
</style>
