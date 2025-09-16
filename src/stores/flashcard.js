import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFlashcardStore = defineStore('flashcard', () => {
  // 狀態
  const decks = ref([])
  const currentDeck = ref(null)
  const currentCard = ref(null)
  const studySession = ref(null)
  const isLoading = ref(false)

  // 計算屬性
  const deckCount = computed(() => decks.value.length)
  const hasDecks = computed(() => decks.value.length > 0)
  const currentDeckCards = computed(() =>
    currentDeck.value ? currentDeck.value.cards : []
  )
  const studyProgress = computed(() => {
    if (!studySession.value) return 0
    const { completed, total } = studySession.value
    return total > 0 ? (completed / total) * 100 : 0
  })

  // 牌組管理
  async function loadDecks() {
    isLoading.value = true
    try {
      const saved = localStorage.getItem('citeright_flashcard_decks')
      if (saved) {
        const parsed = JSON.parse(saved)
        decks.value = Array.isArray(parsed) ? parsed : []
        console.log('🃏 已載入牌組:', decks.value.length, '個')
      } else {
        // 載入預設的台灣法律牌組
        await loadDefaultDecks()
      }
    } catch (error) {
      console.error('載入牌組失敗:', error)
      decks.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function loadDefaultDecks() {
    const defaultDecks = [
      {
        id: 'constitutional-interpretation',
        name: '大法官解釋',
        description: '重要憲法解釋案例',
        category: 'constitutional',
        difficulty: 'intermediate',
        tags: ['憲法', '釋字', '人權'],
        cards: [
          {
            id: 'const-1',
            question: '釋字第812號解釋主要處理什麼爭議？',
            answer: '刑法、竊盜犯贓物犯保安處分條例及組織犯罪防制條例所規定之強制工作是否違憲？',
            category: '釋字812',
            difficulty: 'intermediate',
            tags: ['強制工作', '人身自由', '比例原則'],
            source: '釋字第812號',
            explanation: '本案涉及保安處分與刑罰的明顯區隔原則，以及比例原則在人身自由限制上的適用。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'const-2',
            question: '大法官對人身自由限制採用什麼審查標準？',
            answer: '嚴格標準審查 - 目的須為特別重要公共利益，手段須為侵害最小且具相稱性',
            category: '審查標準',
            difficulty: 'advanced',
            tags: ['人身自由', '審查標準', '比例原則'],
            source: '釋字第812號',
            explanation: '人身自由為基本權利之前提，因此需要最嚴格的審查標準來保障。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'const-3',
            question: '什麼是「明顯區隔原則」？',
            answer: '保安處分之規範及執行須與刑罰有明顯區隔，避免實質上雙重處罰',
            category: '法理原則',
            difficulty: 'advanced',
            tags: ['保安處分', '刑罰', '明顯區隔'],
            source: '釋字第812號',
            explanation: '保安處分與刑罰性質不同，前者為矯治措施，後者為處罰措施，兩者在制度設計和執行上必須有明顯區別。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 3,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      },
      {
        id: 'civil-law-basics',
        name: '民法基礎',
        description: '民法總則重要概念',
        category: 'civil',
        difficulty: 'beginner',
        tags: ['民法', '總則', '基礎'],
        cards: [
          {
            id: 'civil-1',
            question: '民法第1條規定的法源順序為何？',
            answer: '法律、習慣、法理',
            category: '法源',
            difficulty: 'beginner',
            tags: ['法源', '民法第1條'],
            source: '民法第1條',
            explanation: '成文法優先於不成文法，習慣必須不違背公共秩序或善良風俗。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'civil-2',
            question: '權利能力的開始和終止為何？',
            answer: '出生時開始，死亡時終止',
            category: '人格權',
            difficulty: 'beginner',
            tags: ['權利能力', '人格權'],
            source: '民法第6條、第7條',
            explanation: '自然人的權利能力始於出生，終於死亡，為民法基本原則。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 2,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      },
      // 台灣律師考試熱門法科
      {
        id: 'criminal-law',
        name: '刑法',
        description: '刑法總則與分則重要概念',
        category: 'criminal',
        difficulty: 'intermediate',
        tags: ['刑法', '犯罪構成', '正當防衛', '刑罰理論'],
        cards: [
          {
            id: 'crim-1',
            question: '刑法第13條關於故意之規定為何？',
            answer: '行為人對於構成犯罪之事實，明知並有意使其發生者，為故意。',
            category: '故意過失',
            difficulty: 'beginner',
            tags: ['故意', '刑法第13條'],
            source: '刑法第13條',
            explanation: '故意分為直接故意（明知並有意）和間接故意（預見可能發生而其發生並不違背本意）。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'crim-2',
            question: '正當防衛的成立要件有哪些？',
            answer: '1.對於現在不法之侵害 2.為防衛自己或他人之權利 3.所為之行為 4.不得超過必要之程度',
            category: '阻卻違法',
            difficulty: 'intermediate',
            tags: ['正當防衛', '阻卻違法事由'],
            source: '刑法第23條',
            explanation: '正當防衛需要同時滿足四個要件，缺一不可。特別注意「現在」和「不法」的認定。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'crim-3',
            question: '刑法上「行為」的概念為何？',
            answer: '人之身體動靜，由意思所支配，而表現於外部者。包括積極行為（作為）與消極行為（不作為）。',
            category: '犯罪論',
            difficulty: 'intermediate',
            tags: ['行為概念', '作為', '不作為'],
            source: '刑法理論',
            explanation: '行為是犯罪成立的前提，必須有意思支配的身體動靜，反射動作不屬於刑法上的行為。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'crim-4',
            question: '緊急避難與正當防衛的區別為何？',
            answer: '緊急避難是避免自己或他人生命、身體、自由、財產之緊急危難而出於不得已之行為；正當防衛是對抗不法侵害。緊急避難有補償義務，正當防衛無。',
            category: '阻卻違法',
            difficulty: 'advanced',
            tags: ['緊急避難', '正當防衛', '阻卻違法'],
            source: '刑法第24條、第23條',
            explanation: '緊急避難針對的是危難（可能來自自然災害），正當防衛針對的是不法侵害（人為）。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 4,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      },
      {
        id: 'administrative-law',
        name: '行政法',
        description: '行政程序、行政救濟、公權力行使',
        category: 'administrative',
        difficulty: 'advanced',
        tags: ['行政法', '行政程序', '行政救濟', '公權力'],
        cards: [
          {
            id: 'admin-1',
            question: '行政程序法第1條規定之立法目的為何？',
            answer: '為使行政行為遵循公正、公開與民主之程序，確保依法行政之原則，以保障人民權益，提高行政效能，增進人民對行政之信賴。',
            category: '立法目的',
            difficulty: 'beginner',
            tags: ['行政程序法', '立法目的', '依法行政'],
            source: '行政程序法第1條',
            explanation: '行政程序法的三大核心價值：公正、公開、民主程序。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'admin-2',
            question: '行政處分之定義為何？',
            answer: '指行政機關就公法上具體事件所為之決定或其他公權力措施而對外直接發生法律效果之單方行政行為。',
            category: '行政處分',
            difficulty: 'intermediate',
            tags: ['行政處分', '定義', '公權力'],
            source: '行政程序法第92條',
            explanation: '行政處分的五個要件：行政機關、公法事件、公權力措施、對外、直接法律效果。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'admin-3',
            question: '訴願之要件有哪些？',
            answer: '1.須有行政處分 2.須為違法或不當 3.須損害權利或法律上利益 4.須有訴願能力 5.須於法定期間內提起 6.須向有管轄權機關提起',
            category: '行政救濟',
            difficulty: 'advanced',
            tags: ['訴願', '行政救濟', '要件'],
            source: '訴願法',
            explanation: '訴願是行政救濟的第一階段，期間為30日，向原處分機關之上級機關提起。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 3,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      },
      {
        id: 'commercial-law',
        name: '商法',
        description: '公司法、證券交易法、保險法',
        category: 'commercial',
        difficulty: 'advanced',
        tags: ['商法', '公司法', '證券交易法', '保險法'],
        cards: [
          {
            id: 'comm-1',
            question: '公司之定義為何？',
            answer: '指以營利為目的，依公司法組織、登記、成立之社團法人。',
            category: '公司法總則',
            difficulty: 'beginner',
            tags: ['公司', '定義', '社團法人'],
            source: '公司法第1條',
            explanation: '公司具有營利性、組織性、登記性、法人性四大特徵。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'comm-2',
            question: '股份有限公司董事之忠實義務內容為何？',
            answer: '董事應忠實執行業務並盡善良管理人之注意義務，不得為自己或他人為屬於公司營業範圍內之行為，不得自己或以他人名義與公司為買賣等交易。',
            category: '董事責任',
            difficulty: 'advanced',
            tags: ['董事', '忠實義務', '善管義務'],
            source: '公司法第23條',
            explanation: '董事對公司負有忠實義務和注意義務，違反者需負損害賠償責任。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          },
          {
            id: 'comm-3',
            question: '證券之定義包含哪些項目？',
            answer: '1.股票 2.公債 3.公司債 4.受益憑證 5.存託憑證 6.認購權證 7.認股權證 8.其他由主管機關核定之有價證券',
            category: '證券定義',
            difficulty: 'intermediate',
            tags: ['證券', '有價證券', '定義'],
            source: '證券交易法第6條',
            explanation: '證券交易法採列舉式定義，並有概括條款授權主管機關認定。',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 3,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      }
    ]

    decks.value = defaultDecks
    saveDecks()
    console.log('🃏 已載入預設牌組')
  }

  function createDeck(deckData) {
    const newDeck = {
      id: `deck_${Date.now()}`,
      name: deckData.name || '新牌組',
      description: deckData.description || '',
      category: deckData.category || 'general',
      difficulty: deckData.difficulty || 'beginner',
      tags: deckData.tags || [],
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        totalCards: 0,
        studiedToday: 0,
        averageScore: 0,
        lastStudied: null
      }
    }

    decks.value.push(newDeck)
    saveDecks()
    console.log('✅ 已建立新牌組:', newDeck.name)
    return newDeck
  }

  function deleteDeck(deckId) {
    const index = decks.value.findIndex(d => d.id === deckId)
    if (index > -1) {
      const removed = decks.value.splice(index, 1)[0]
      saveDecks()
      console.log('🗑️ 已刪除牌組:', removed.name)
      return true
    }
    return false
  }

  // 卡片管理
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

    console.log('✅ 已新增卡片到牌組:', deck.name)
    return newCard
  }

  function updateCard(deckId, cardId, cardData) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return false

    const card = deck.cards.find(c => c.id === cardId)
    if (!card) return false

    Object.assign(card, cardData, { updatedAt: new Date().toISOString() })
    deck.updatedAt = new Date().toISOString()
    saveDecks()

    console.log('✅ 已更新卡片')
    return card
  }

  function deleteCard(deckId, cardId) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck) return false

    const index = deck.cards.findIndex(c => c.id === cardId)
    if (index > -1) {
      deck.cards.splice(index, 1)
      deck.stats.totalCards = deck.cards.length
      deck.updatedAt = new Date().toISOString()
      saveDecks()
      console.log('🗑️ 已刪除卡片')
      return true
    }
    return false
  }

  // 學習會話管理
  function startStudySession(deckId, options = {}) {
    const deck = decks.value.find(d => d.id === deckId)
    if (!deck || deck.cards.length === 0) return false

    // 根據間隔重複算法排序卡片
    const sortedCards = [...deck.cards].sort((a, b) => {
      const aScore = getCardPriority(a)
      const bScore = getCardPriority(b)
      return bScore - aScore
    })

    studySession.value = {
      deckId,
      deckName: deck.name,
      cards: sortedCards,
      currentIndex: 0,
      completed: 0,
      total: sortedCards.length,
      startTime: new Date(),
      scores: [],
      options
    }

    currentDeck.value = deck
    currentCard.value = sortedCards[0]

    console.log('🎓 開始學習會話:', deck.name)
    return true
  }

  function answerCard(difficulty) {
    if (!studySession.value || !currentCard.value) return false

    const card = currentCard.value
    const session = studySession.value

    // 更新卡片的間隔重複數據
    updateCardSchedule(card, difficulty)

    // 記錄答案
    session.scores.push({
      cardId: card.id,
      difficulty,
      timestamp: new Date()
    })

    // 移到下一張卡片
    session.completed++
    session.currentIndex++

    if (session.currentIndex < session.cards.length) {
      currentCard.value = session.cards[session.currentIndex]
    } else {
      // 會話結束
      endStudySession()
    }

    saveDecks()
    return true
  }

  function endStudySession() {
    if (!studySession.value) return

    const session = studySession.value
    const deck = currentDeck.value

    // 更新牌組統計
    if (deck) {
      deck.stats.lastStudied = new Date().toISOString()
      deck.stats.studiedToday++

      // 計算平均分數
      const avgScore = session.scores.reduce((sum, s) => sum + getDifficultyScore(s.difficulty), 0) / session.scores.length
      deck.stats.averageScore = avgScore
    }

    console.log('🎓 學習會話結束，已完成', session.completed, '張卡片')

    studySession.value = null
    currentCard.value = null
    saveDecks()
  }

  // 間隔重複算法
  function getCardPriority(card) {
    if (!card.nextReview) return 100 // 新卡片優先

    const now = new Date()
    const nextReview = new Date(card.nextReview)

    if (now >= nextReview) {
      return 50 + (now - nextReview) / (1000 * 60 * 60 * 24) // 逾期天數作為權重
    }

    return Math.max(0, (nextReview - now) / (1000 * 60 * 60 * 24)) // 距離復習時間
  }

  function updateCardSchedule(card, difficulty) {
    const now = new Date()
    card.reviewCount++

    let interval = card.interval || 1
    let easeFactor = card.easeFactor || 2.5

    // SuperMemo 2 算法簡化版
    switch (difficulty) {
      case 'again': // 重來 (0)
        interval = 1
        easeFactor = Math.max(1.3, easeFactor - 0.2)
        break
      case 'hard': // 困難 (1)
        interval = Math.max(1, Math.round(interval * 1.2))
        easeFactor = Math.max(1.3, easeFactor - 0.15)
        break
      case 'good': // 良好 (2)
        if (card.reviewCount === 1) {
          interval = 6
        } else {
          interval = Math.round(interval * easeFactor)
        }
        break
      case 'easy': // 簡單 (3)
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

  function getDifficultyScore(difficulty) {
    switch (difficulty) {
      case 'again': return 0
      case 'hard': return 1
      case 'good': return 2
      case 'easy': return 3
      default: return 1
    }
  }

  // 資料持久化
  function saveDecks() {
    try {
      localStorage.setItem('citeright_flashcard_decks', JSON.stringify(decks.value))
      console.log('💾 牌組已儲存，共', decks.value.length, '個')
    } catch (error) {
      console.error('儲存牌組失敗:', error)
    }
  }

  // 匯入/匯出
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
    console.log('📤 牌組已匯出:', deck.name)
    return true
  }

  function importDeck(fileContent) {
    try {
      const importedDeck = JSON.parse(fileContent)
      if (importedDeck.cards && Array.isArray(importedDeck.cards)) {
        // 避免ID衝突
        importedDeck.id = `imported_${Date.now()}`
        importedDeck.cards.forEach(card => {
          card.id = `imported_card_${Date.now()}_${Math.random()}`
        })

        decks.value.push(importedDeck)
        saveDecks()

        console.log('📥 已匯入牌組:', importedDeck.name)
        return importedDeck
      } else {
        throw new Error('匯入的資料格式不正確')
      }
    } catch (error) {
      console.error('匯入牌組失敗:', error)
      throw error
    }
  }

  // 書籤轉換為智能測驗
  async function createDeckFromBookmarks() {
    try {
      const { useBookmarkStore } = await import('./bookmark')
      const bookmarkStore = useBookmarkStore()

      if (!bookmarkStore.hasBookmarks) {
        throw new Error('沒有可用的書籤資料')
      }

      const bookmarkQuizDeck = {
        id: `bookmark_quiz_${Date.now()}`,
        name: '書籤智能測驗',
        description: `根據您的 ${bookmarkStore.bookmarkCount} 個書籤自動生成的測驗`,
        category: 'bookmark',
        difficulty: 'intermediate',
        tags: ['書籤', '智能測驗', '自動生成'],
        cards: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalCards: 0,
          studiedToday: 0,
          averageScore: 0,
          lastStudied: null
        }
      }

      // 從書籤生成測驗卡片
      bookmarkStore.bookmarks.forEach((bookmark, index) => {
        const cards = generateCardsFromBookmark(bookmark)
        bookmarkQuizDeck.cards.push(...cards)
      })

      bookmarkQuizDeck.stats.totalCards = bookmarkQuizDeck.cards.length

      if (bookmarkQuizDeck.cards.length > 0) {
        decks.value.push(bookmarkQuizDeck)
        saveDecks()
        console.log('✅ 已從書籤生成測驗牌組:', bookmarkQuizDeck.cards.length, '張卡片')
        return bookmarkQuizDeck
      } else {
        throw new Error('無法從書籤生成測驗卡片')
      }

    } catch (error) {
      console.error('書籤轉換測驗失敗:', error)
      throw error
    }
  }

  // 從單個書籤生成測驗卡片
  function generateCardsFromBookmark(bookmark) {
    const cards = []
    const baseId = `bookmark_${bookmark.id || Date.now()}_${Math.random()}`

    // 根據書籤類型生成不同的測驗
    if (bookmark.type === 'interpretation') {
      // 釋字測驗
      if (bookmark.number) {
        cards.push({
          id: `${baseId}_1`,
          question: `釋字第${bookmark.number}號主要處理什麼爭議？`,
          answer: bookmark.issue || bookmark.description || '請參考釋字內容',
          category: '大法官解釋',
          difficulty: 'intermediate',
          tags: ['釋字', `釋字第${bookmark.number}號`],
          source: `釋字第${bookmark.number}號`,
          explanation: bookmark.reasoning || '請參考理由書',
          nextReview: null,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1
        })
      }

      if (bookmark.issue && bookmark.description) {
        cards.push({
          id: `${baseId}_2`,
          question: `關於${bookmark.title || '此解釋'}，大法官的見解為何？`,
          answer: bookmark.description,
          category: '大法官解釋',
          difficulty: 'advanced',
          tags: ['釋字', '解釋文'],
          source: bookmark.title || '大法官解釋',
          explanation: bookmark.reasoning || bookmark.issue,
          nextReview: null,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1
        })
      }
    } else if (bookmark.type === 'law') {
      // 法條測驗
      if (bookmark.lawName && bookmark.content) {
        // 法條內容測驗
        cards.push({
          id: `${baseId}_1`,
          question: `${bookmark.lawName}${bookmark.number ? `第${bookmark.number}條` : ''}的規定為何？`,
          answer: extractMainContent(bookmark.content),
          category: '法條記憶',
          difficulty: 'beginner',
          tags: ['法條', bookmark.lawName],
          source: bookmark.lawName,
          explanation: `請參考${bookmark.lawName}完整條文`,
          nextReview: null,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1
        })

        // 法條應用測驗
        if (bookmark.content.length > 100) {
          cards.push({
            id: `${baseId}_2`,
            question: `在什麼情況下會適用${bookmark.lawName}${bookmark.number ? `第${bookmark.number}條` : ''}？`,
            answer: generateApplicationAnswer(bookmark.lawName, bookmark.content),
            category: '法條適用',
            difficulty: 'intermediate',
            tags: ['法條適用', bookmark.lawName],
            source: bookmark.lawName,
            explanation: '請結合具體案例思考適用情境',
            nextReview: null,
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 1
          })
        }
      }
    } else {
      // 一般書籤內容測驗
      if (bookmark.title && bookmark.content) {
        cards.push({
          id: `${baseId}_1`,
          question: `關於「${bookmark.title}」的重要內容是什麼？`,
          answer: extractMainContent(bookmark.content),
          category: '重點整理',
          difficulty: 'beginner',
          tags: ['書籤內容', '重點'],
          source: bookmark.title,
          explanation: '請參考原始書籤內容',
          nextReview: null,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 1
        })
      }
    }

    return cards
  }

  // 提取主要內容（去除HTML標籤，取前200字）
  function extractMainContent(content) {
    if (!content) return '無內容'

    // 去除HTML標籤
    const textContent = content.replace(/<[^>]*>/g, '').trim()

    // 取前200字
    return textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent
  }

  // 生成法條應用答案
  function generateApplicationAnswer(lawName, content) {
    const contexts = {
      '民法': '在民事法律關係中，當事人之間的權利義務關係需要法律規範時適用。',
      '刑法': '當行為人的行為涉及犯罪構成要件，需要追究刑事責任時適用。',
      '行政法': '行政機關行使公權力，對人民權利義務產生影響時適用。',
      '公司法': '公司設立、經營、管理過程中的相關法律問題適用。',
      '憲法': '涉及基本權利保障或政府組織運作的根本性問題時適用。'
    }

    for (const [law, context] of Object.entries(contexts)) {
      if (lawName.includes(law)) {
        return context
      }
    }

    return '在相關法律情境中，符合該條文規定的構成要件時適用。'
  }

  return {
    // 狀態
    decks,
    currentDeck,
    currentCard,
    studySession,
    isLoading,

    // 計算屬性
    deckCount,
    hasDecks,
    currentDeckCards,
    studyProgress,

    // 動作
    loadDecks,
    createDeck,
    deleteDeck,
    addCard,
    updateCard,
    deleteCard,
    startStudySession,
    answerCard,
    endStudySession,
    exportDeck,
    importDeck,
    createDeckFromBookmarks
  }
})