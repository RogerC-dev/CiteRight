import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/apiService'

export const useFlashcardStore = defineStore('flashcard', () => {
  // State
  const flashcards = ref([])
  const dueFlashcards = ref([])
  const currentFlashcard = ref(null)
  const studySession = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const isOnline = ref(false)
  const stats = ref({
    total: 0,
    due: 0,
    mastered: 0,
    learning: 0,
    new: 0
  })

  // Legacy deck support for local storage
  const decks = ref([])
  const currentDeck = ref(null)

  // Computed properties
  const flashcardCount = computed(() => flashcards.value.length)
  const hasFlashcards = computed(() => flashcards.value.length > 0)
  const dueCount = computed(() => dueFlashcards.value.length)
  const studyProgress = computed(() => {
    if (!studySession.value) return 0
    const { completed, total } = studySession.value
    return total > 0 ? (completed / total) * 100 : 0
  })

  // Initialize API connection
  async function initializeApi() {
    try {
      await apiService.loadTokens()
      isOnline.value = apiService.isAuthenticated()
      if (isOnline.value) {
        console.log('[Flashcard] API connection established')
      }
    } catch (err) {
      console.warn('[Flashcard] API initialization failed:', err)
      isOnline.value = false
    }
  }

  // Load flashcards from API or local storage
  async function loadFlashcards(filter = '') {
    isLoading.value = true
    error.value = null

    try {
      await initializeApi()

      if (isOnline.value) {
        // Fetch from ExamQuestionBank API
        const response = await apiService.getFlashcards(filter)
        flashcards.value = response.results || response || []
        console.log('[Flashcard] Loaded from API:', flashcards.value.length)
      } else {
        // Fallback to local storage
        await loadFromLocalStorage()
      }

      await updateStats()
    } catch (err) {
      console.error('[Flashcard] Load error:', err)
      error.value = err.message
      // Fallback to local storage on error
      await loadFromLocalStorage()
    } finally {
      isLoading.value = false
    }
  }

  // Load due flashcards for review
  async function loadDueFlashcards() {
    isLoading.value = true
    error.value = null

    try {
      if (isOnline.value) {
        const response = await apiService.getDueFlashcards()
        dueFlashcards.value = response.results || response || []
        console.log('[Flashcard] Due cards loaded:', dueFlashcards.value.length)
      } else {
        // Calculate due cards from local storage
        const now = new Date()
        dueFlashcards.value = flashcards.value.filter(card => {
          if (!card.nextReview) return true // New cards are due
          return new Date(card.nextReview) <= now
        })
      }
    } catch (err) {
      console.error('[Flashcard] Load due error:', err)
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }

  // Create a new flashcard
  async function createFlashcard(data) {
    isLoading.value = true
    error.value = null

    try {
      if (isOnline.value) {
        const newCard = await apiService.createFlashcard(data)
        flashcards.value.unshift(newCard)
        console.log('[Flashcard] Created via API:', newCard.id)
        return newCard
      } else {
        // Create locally
        const newCard = {
          id: `local_${Date.now()}`,
          ...data,
          nextReview: null,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1,
          createdAt: new Date().toISOString()
        }
        flashcards.value.unshift(newCard)
        await saveToLocalStorage()
        return newCard
      }
    } catch (err) {
      console.error('[Flashcard] Create error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update a flashcard
  async function updateFlashcard(flashcardId, data) {
    isLoading.value = true
    error.value = null

    try {
      if (isOnline.value) {
        const updated = await apiService.updateFlashcard(flashcardId, data)
        const index = flashcards.value.findIndex(c => c.id === flashcardId)
        if (index > -1) {
          flashcards.value[index] = { ...flashcards.value[index], ...updated }
        }
        return updated
      } else {
        const index = flashcards.value.findIndex(c => c.id === flashcardId)
        if (index > -1) {
          flashcards.value[index] = { ...flashcards.value[index], ...data, updatedAt: new Date().toISOString() }
          await saveToLocalStorage()
          return flashcards.value[index]
        }
      }
    } catch (err) {
      console.error('[Flashcard] Update error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete a flashcard
  async function deleteFlashcard(flashcardId) {
    isLoading.value = true
    error.value = null

    try {
      if (isOnline.value) {
        await apiService.deleteFlashcard(flashcardId)
      }
      flashcards.value = flashcards.value.filter(c => c.id !== flashcardId)
      dueFlashcards.value = dueFlashcards.value.filter(c => c.id !== flashcardId)

      if (!isOnline.value) {
        await saveToLocalStorage()
      }
      console.log('[Flashcard] Deleted:', flashcardId)
      return true
    } catch (err) {
      console.error('[Flashcard] Delete error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Review a flashcard
  async function reviewFlashcard(flashcardId, quality) {
    error.value = null

    try {
      if (isOnline.value) {
        const result = await apiService.reviewFlashcard(flashcardId, quality)
        // Update local copy
        const index = flashcards.value.findIndex(c => c.id === flashcardId)
        if (index > -1) {
          flashcards.value[index] = { ...flashcards.value[index], ...result }
        }
        return result
      } else {
        // Local spaced repetition algorithm
        const card = flashcards.value.find(c => c.id === flashcardId)
        if (card) {
          updateCardSchedule(card, quality)
          await saveToLocalStorage()
        }
        return card
      }
    } catch (err) {
      console.error('[Flashcard] Review error:', err)
      error.value = err.message
      throw err
    }
  }

  // Start a study session
  function startStudySession(cards = null) {
    const cardsToStudy = cards || dueFlashcards.value

    if (cardsToStudy.length === 0) {
      error.value = 'No cards available for study'
      return false
    }

    // Sort by priority (overdue first, then new)
    const sortedCards = [...cardsToStudy].sort((a, b) => {
      const aScore = getCardPriority(a)
      const bScore = getCardPriority(b)
      return bScore - aScore
    })

    studySession.value = {
      cards: sortedCards,
      currentIndex: 0,
      completed: 0,
      total: sortedCards.length,
      startTime: new Date(),
      scores: []
    }

    currentFlashcard.value = sortedCards[0]
    console.log('[Flashcard] Study session started:', sortedCards.length, 'cards')
    return true
  }

  // Answer current card and move to next
  async function answerCard(quality) {
    if (!studySession.value || !currentFlashcard.value) return false

    const card = currentFlashcard.value
    const session = studySession.value

    // Submit review
    await reviewFlashcard(card.id, quality)

    // Record answer
    session.scores.push({
      cardId: card.id,
      quality,
      timestamp: new Date()
    })

    // Move to next card
    session.completed++
    session.currentIndex++

    if (session.currentIndex < session.cards.length) {
      currentFlashcard.value = session.cards[session.currentIndex]
    } else {
      endStudySession()
    }

    return true
  }

  // End study session
  function endStudySession() {
    if (!studySession.value) return

    const session = studySession.value
    console.log('[Flashcard] Study session ended, completed:', session.completed)

    studySession.value = null
    currentFlashcard.value = null

    // Refresh stats
    updateStats()
  }

  // Update statistics
  async function updateStats() {
    try {
      if (isOnline.value) {
        const apiStats = await apiService.getFlashcardStats()
        stats.value = {
          total: apiStats.total || flashcards.value.length,
          due: apiStats.due || dueFlashcards.value.length,
          mastered: apiStats.mastered || 0,
          learning: apiStats.learning || 0,
          new: apiStats.new || 0
        }
      } else {
        const now = new Date()
        stats.value = {
          total: flashcards.value.length,
          due: flashcards.value.filter(c => !c.nextReview || new Date(c.nextReview) <= now).length,
          mastered: flashcards.value.filter(c => c.interval >= 21).length,
          learning: flashcards.value.filter(c => c.reviewCount > 0 && c.interval < 21).length,
          new: flashcards.value.filter(c => c.reviewCount === 0).length
        }
      }
    } catch (err) {
      console.warn('[Flashcard] Stats update error:', err)
    }
  }

  // Spaced repetition algorithm (SuperMemo 2)
  function getCardPriority(card) {
    if (!card.nextReview) return 100 // New cards are high priority

    const now = new Date()
    const nextReview = new Date(card.nextReview)

    if (now >= nextReview) {
      return 50 + (now - nextReview) / (1000 * 60 * 60 * 24) // Overdue days as weight
    }

    return Math.max(0, (nextReview - now) / (1000 * 60 * 60 * 24))
  }

  function updateCardSchedule(card, quality) {
    const now = new Date()
    card.reviewCount = (card.reviewCount || 0) + 1

    let interval = card.interval || 1
    let easeFactor = card.easeFactor || 2.5

    // Quality: 0 = again, 1 = hard, 2 = good, 3 = easy
    switch (quality) {
      case 0: // Again
        interval = 1
        easeFactor = Math.max(1.3, easeFactor - 0.2)
        break
      case 1: // Hard
        interval = Math.max(1, Math.round(interval * 1.2))
        easeFactor = Math.max(1.3, easeFactor - 0.15)
        break
      case 2: // Good
        if (card.reviewCount === 1) {
          interval = 6
        } else {
          interval = Math.round(interval * easeFactor)
        }
        break
      case 3: // Easy
        if (card.reviewCount === 1) {
          interval = 4
        } else {
          interval = Math.round(interval * easeFactor * 1.3)
        }
        easeFactor = Math.min(3.0, easeFactor + 0.15)
        break
    }

    card.interval = interval
    card.easeFactor = easeFactor
    card.nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString()
  }

  // Local storage management
  async function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('citeright_flashcards')
      if (saved) {
        const parsed = JSON.parse(saved)
        flashcards.value = Array.isArray(parsed) ? parsed : []
      } else {
        // Load default decks and extract cards
        await loadDefaultDecks()
        flashcards.value = decks.value.flatMap(d => d.cards.map(c => ({
          ...c,
          deckId: d.id,
          deckName: d.name
        })))
      }
      console.log('[Flashcard] Loaded from local storage:', flashcards.value.length)
    } catch (err) {
      console.error('[Flashcard] Local storage error:', err)
      flashcards.value = []
    }
  }

  async function saveToLocalStorage() {
    try {
      localStorage.setItem('citeright_flashcards', JSON.stringify(flashcards.value))
      console.log('[Flashcard] Saved to local storage:', flashcards.value.length)
    } catch (err) {
      console.error('[Flashcard] Save error:', err)
    }
  }

  // Default decks for offline use
  async function loadDefaultDecks() {
    const defaultDecks = [
      {
        id: 'constitutional-interpretation',
        name: 'Constitutional Interpretations',
        description: 'Important constitutional interpretation cases',
        category: 'constitutional',
        difficulty: 'intermediate',
        tags: ['Constitution', 'Interpretation', 'Human Rights'],
        cards: [
          {
            id: 'const-1',
            question: 'What is the main issue addressed in Interpretation No. 812?',
            answer: 'Whether forced labor provisions in the Criminal Code and security measures are constitutional.',
            category: 'Interpretation 812',
            difficulty: 'intermediate',
            tags: ['Forced Labor', 'Personal Freedom', 'Proportionality'],
            source: 'Interpretation No. 812',
            explanation: 'This case involves the principle of clear distinction between security measures and punishment.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'const-2',
            question: 'What standard of review applies to restrictions on personal liberty?',
            answer: 'Strict scrutiny - purpose must serve a compelling public interest, means must be the least restrictive and proportional.',
            category: 'Standard of Review',
            difficulty: 'advanced',
            tags: ['Personal Freedom', 'Standard of Review', 'Proportionality'],
            source: 'Interpretation No. 812',
            explanation: 'Personal liberty is a prerequisite for other fundamental rights, requiring the strictest standard of review.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { totalCards: 2, studiedToday: 0, averageScore: 0, lastStudied: null }
      },
      {
        id: 'civil-law-basics',
        name: 'Civil Law Fundamentals',
        description: 'Essential civil law concepts',
        category: 'civil',
        difficulty: 'beginner',
        tags: ['Civil Law', 'General Principles', 'Basics'],
        cards: [
          {
            id: 'civil-1',
            question: 'What is the order of legal sources according to Civil Code Article 1?',
            answer: 'Statutory law, custom, legal principles (in that order)',
            category: 'Legal Sources',
            difficulty: 'beginner',
            tags: ['Legal Sources', 'Article 1'],
            source: 'Civil Code Article 1',
            explanation: 'Written law takes precedence over unwritten law; customs must not violate public policy.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'civil-2',
            question: 'When does legal capacity begin and end?',
            answer: 'Begins at birth, ends at death',
            category: 'Legal Capacity',
            difficulty: 'beginner',
            tags: ['Legal Capacity', 'Personality Rights'],
            source: 'Civil Code Articles 6, 7',
            explanation: 'Natural persons have legal capacity from birth to death as a fundamental principle of civil law.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { totalCards: 2, studiedToday: 0, averageScore: 0, lastStudied: null }
      },
      {
        id: 'criminal-law',
        name: 'Criminal Law',
        description: 'Criminal law general and specific provisions',
        category: 'criminal',
        difficulty: 'intermediate',
        tags: ['Criminal Law', 'Crime Elements', 'Self-Defense', 'Punishment Theory'],
        cards: [
          {
            id: 'crim-1',
            question: 'How is intent defined under Criminal Code Article 13?',
            answer: 'When the actor knowingly and willingly causes the elements of a crime to occur.',
            category: 'Intent and Negligence',
            difficulty: 'beginner',
            tags: ['Intent', 'Article 13'],
            source: 'Criminal Code Article 13',
            explanation: 'Intent is divided into direct intent (knowingly and willingly) and indirect intent (foreseeing possibility and not contrary to will).',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'crim-2',
            question: 'What are the requirements for self-defense?',
            answer: '1. Against a present unlawful attack 2. To defend rights of self or others 3. The act itself 4. Must not exceed necessary degree',
            category: 'Justification',
            difficulty: 'intermediate',
            tags: ['Self-Defense', 'Justification'],
            source: 'Criminal Code Article 23',
            explanation: 'Self-defense requires all four elements; particular attention to "present" and "unlawful" determination.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { totalCards: 2, studiedToday: 0, averageScore: 0, lastStudied: null }
      },
      {
        id: 'administrative-law',
        name: 'Administrative Law',
        description: 'Administrative procedure, remedies, and exercise of public authority',
        category: 'administrative',
        difficulty: 'advanced',
        tags: ['Administrative Law', 'Administrative Procedure', 'Administrative Remedies', 'Public Authority'],
        cards: [
          {
            id: 'admin-1',
            question: 'What is the legislative purpose stated in Administrative Procedure Act Article 1?',
            answer: 'To ensure administrative acts follow fair, open, and democratic procedures, guarantee the principle of rule of law, protect people\'s rights, improve administrative efficiency, and enhance public trust in administration.',
            category: 'Legislative Purpose',
            difficulty: 'beginner',
            tags: ['Administrative Procedure Act', 'Legislative Purpose', 'Rule of Law'],
            source: 'Administrative Procedure Act Article 1',
            explanation: 'The three core values of administrative procedure law: fair, open, and democratic procedure.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'admin-2',
            question: 'What is the definition of an administrative disposition?',
            answer: 'A decision or other exercise of public authority by an administrative agency regarding specific matters of public law that directly produces legal effects externally.',
            category: 'Administrative Disposition',
            difficulty: 'intermediate',
            tags: ['Administrative Disposition', 'Definition', 'Public Authority'],
            source: 'Administrative Procedure Act Article 92',
            explanation: 'Five elements of administrative disposition: administrative agency, public law matter, exercise of public authority, external, direct legal effect.',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { totalCards: 2, studiedToday: 0, averageScore: 0, lastStudied: null }
      }
    ]

    decks.value = defaultDecks
    saveDecks()
    console.log('[Flashcard] Default decks loaded')
  }

  // Legacy deck management (for backward compatibility)
  const deckCount = computed(() => decks.value.length)
  const hasDecks = computed(() => decks.value.length > 0)

  function loadDecks() {
    try {
      const saved = localStorage.getItem('citeright_flashcard_decks')
      if (saved) {
        decks.value = JSON.parse(saved)
      } else {
        loadDefaultDecks()
      }
    } catch (err) {
      console.error('[Flashcard] Load decks error:', err)
      decks.value = []
    }
  }

  function saveDecks() {
    try {
      localStorage.setItem('citeright_flashcard_decks', JSON.stringify(decks.value))
    } catch (err) {
      console.error('[Flashcard] Save decks error:', err)
    }
  }

  function createDeck(deckData) {
    const newDeck = {
      id: `deck_${Date.now()}`,
      name: deckData.name || 'New Deck',
      description: deckData.description || '',
      category: deckData.category || 'general',
      difficulty: deckData.difficulty || 'beginner',
      tags: deckData.tags || [],
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: { totalCards: 0, studiedToday: 0, averageScore: 0, lastStudied: null }
    }
    decks.value.push(newDeck)
    saveDecks()
    return newDeck
  }

  function deleteDeck(deckId) {
    const index = decks.value.findIndex(d => d.id === deckId)
    if (index > -1) {
      decks.value.splice(index, 1)
      saveDecks()
      return true
    }
    return false
  }

  function addCard(deckId, cardData) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return false

    const newCard = {
      id: `card_${Date.now()}`,
      question: cardData.question || '',
      answer: cardData.answer || '',
      category: cardData.category || '',
      difficulty: cardData.difficulty || 'beginner',
      tags: cardData.tags || [],
      source: cardData.source || '',
      explanation: cardData.explanation || '',
      nextReview: null,
      reviewCount: 0,
      easeFactor: 2.5,
      interval: 1,
      createdAt: new Date().toISOString()
    }

    deck.cards.push(newCard)
    deck.stats.totalCards = deck.cards.length
    deck.updatedAt = new Date().toISOString()
    saveDecks()
    return newCard
  }

  // Export/Import
  function exportDeck(deckId) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return null

    const dataStr = JSON.stringify(deck, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `flashcard-deck-${deck.name}-${new Date().toISOString().split('T')[0]}.json`
    link.click()

    URL.revokeObjectURL(url)
    return true
  }

  function importDeck(fileContent) {
    try {
      const importedDeck = JSON.parse(fileContent)
      if (importedDeck.cards && Array.isArray(importedDeck.cards)) {
        importedDeck.id = `imported_${Date.now()}`
        importedDeck.cards.forEach(card => {
          card.id = `imported_card_${Date.now()}_${Math.random()}`
        })
        decks.value.push(importedDeck)
        saveDecks()
        return importedDeck
      }
      throw new Error('Invalid deck format')
    } catch (err) {
      console.error('[Flashcard] Import error:', err)
      throw err
    }
  }

  return {
    // API-based state
    flashcards,
    dueFlashcards,
    currentFlashcard,
    studySession,
    isLoading,
    error,
    isOnline,
    stats,

    // Computed
    flashcardCount,
    hasFlashcards,
    dueCount,
    studyProgress,

    // API-based actions
    initializeApi,
    loadFlashcards,
    loadDueFlashcards,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
    reviewFlashcard,
    startStudySession,
    answerCard,
    endStudySession,
    updateStats,

    // Legacy deck support
    decks,
    currentDeck,
    deckCount,
    hasDecks,
    loadDecks,
    createDeck,
    deleteDeck,
    addCard,
    exportDeck,
    importDeck
  }
})
