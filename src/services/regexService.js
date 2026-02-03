/**
 * 正規表示式服務 - 負責動態生成法條匹配模式
 */

import { escapeHtml } from './textProcessor.js'

// 統一的中文數字字符集
const CHINESE_NUMBERS = '[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]'

// 更精確的中文數字模式
const CHINESE_NUMBER_PATTERN = '(?:[0-9０-９]+|[一二三四五六七八九十拾壹貳參肆伍陸柒捌玖拾百佰千仟萬億兆零]+|二十[一二三四五六七八九]?|三十[一二三四五六七八九]?|[一二三四五六七八九]?十[一二三四五六七八九]?)'

// 法條別名字典 - 簡稱對應到全稱
const LAW_ALIASES = {
  // 基本法律
  '憲法': ['中華民國憲法', '憲法'],
  '憲法增修條文': ['憲法增修條文'],
  '民法': ['民法'],
  '刑法': ['中華民國刑法', '刑法'],
  '商法': ['商事法', '公司法'],

  // 程序法
  '民事訴訟法': ['民事訴訟法'],
  '刑事訴訟法': ['刑事訴訟法'],
  '行政程序法': ['行政程序法'],
  '行政訴訟法': ['行政訴訟法'],

  // 特別法
  '集會遊行法': ['集會遊行法'],
  '公司法': ['公司法'],
  '勞動基準法': ['勞動基準法', '勞基法'],
  '所得稅法': ['所得稅法'],
  '營業稅法': ['加值型及非加值型營業稅法', '營業稅法'],
  '土地法': ['土地法'],
  '都市計畫法': ['都市計畫法'],
  '建築法': ['建築法'],
  '環保法': ['環境保護法'],

  // 大法官相關法律
  '大法官審理案件法': ['司法院大法官審理案件法'],
  '司法院大法官審理案件法施行細則': ['司法院大法官審理案件法施行細則'],

  // 國安相關法律
  '國家安全法': ['國家安全法'],

  // 其他常見別名
  '社會秩序維護法': ['社會秩序維護法'],
  '勞基法': ['勞動基準法'],
  '兒少法': ['兒童及少年福利與權益保障法'],
  '家暴法': ['家庭暴力防治法'],
  '性平法': ['性別平等教育法', '性別工作平等法'],
  '食安法': ['食品安全衛生管理法'],
  '藥事法': ['藥事法'],
  '醫師法': ['醫師法'],
  '民訴': ['民事訴訟法'],
  '刑訴': ['刑事訴訟法'],
  '行訴': ['行政訴訟法'],
  '大審法': ['司法院大法官審理案件法'],
  '憲訴法': ['憲法訴訟法'],
  '國安法': ['國家安全法'],
  '社維法': ['社會秩序維護法'],
  '行程法': ['行政程序法'],
  '證交法': ['證券交易法'],
  '強執法': ['強制執行法'],
  '家事法': ['家事事件法'],
  '少事法': ['少年事件處理法'],
  '智財法': ['智慧財產案件審理法'],
  '職安法': ['職業安全衛生法'],
  '著作權法': ['著作權法'],
  '專利法': ['專利法'],
  '商標法': ['商標法'],
  '消保法': ['消費者保護法'],
  '個資法': ['個人資料保護法'],
  '健保法': ['全民健康保險法']
}

// 反向別名字典
let REVERSE_LAW_ALIASES = {}

/**
 * 建立法律別名的反向對應
 */
function buildReverseLawAliases() {
  REVERSE_LAW_ALIASES = {}
  for (const [shortName, fullNames] of Object.entries(LAW_ALIASES)) {
    for (const fullName of fullNames) {
      REVERSE_LAW_ALIASES[fullName] = shortName
    }
  }
}

/**
 * 創建簡化的法律名稱
 * @param {string} fullName - 完整法律名稱
 * @returns {string|null} - 簡化後的名稱
 */
function createSimplifiedLawName(fullName) {
  // 移除常見的前綴詞
  let simplified = fullName
    .replace(/^中華民國/, '')
    .replace(/^臺灣省/, '')
    .replace(/^台灣省/, '')
    .replace(/^行政院/, '')
    .replace(/^司法院/, '')
    .replace(/^立法院/, '')
    .replace(/^考試院/, '')
    .replace(/^監察院/, '')

  // 移除常見的後綴詞但保留核心
  simplified = simplified
    .replace(/施行細則$/, '')
    .replace(/實施辦法$/, '')
    .replace(/管理辦法$/, '')
    .replace(/作業辦法$/, '')

  // 如果簡化後太短或沒變化，返回null
  if (simplified.length < 2 || simplified === fullName) {
    return null
  }

  return simplified
}

/**
 * 根據Law.json內容動態擴展別名字典
 * @param {Array} legalNamesArray - 法律名稱陣列
 */
function expandLawAliases(legalNamesArray) {
  buildReverseLawAliases()

  // 為每個Law.json中的法律名稱檢查是否需要建立別名
  for (const lawName of legalNamesArray) {
    // 檢查是否已有反向對應
    if (!REVERSE_LAW_ALIASES[lawName]) {
      // 嘗試建立常見的簡化對應
      const simplifiedName = createSimplifiedLawName(lawName)
      if (simplifiedName && simplifiedName !== lawName) {
        if (!LAW_ALIASES[simplifiedName]) {
          LAW_ALIASES[simplifiedName] = []
        }
        if (!LAW_ALIASES[simplifiedName].includes(lawName)) {
          LAW_ALIASES[simplifiedName].push(lawName)
        }
        REVERSE_LAW_ALIASES[lawName] = simplifiedName
      }
    }
  }

  console.log('✅ 法條別名字典擴展完成，共', Object.keys(LAW_ALIASES).length, '個別名對應')
}

/**
 * 查找法律的標準名稱（從Law.json中的實際名稱）
 * @param {string} inputName - 輸入的法律名稱
 * @param {Array} legalNames - 可用的法律名稱列表
 * @returns {string} - 標準法律名稱
 */
export function findStandardLawName(inputName, legalNames) {
  // 先檢查是否為別名
  if (LAW_ALIASES[inputName]) {
    // 返回在legalNames中找到的第一個匹配名稱
    for (const candidate of LAW_ALIASES[inputName]) {
      if (legalNames && legalNames.includes(candidate)) {
        return candidate
      }
    }
  }

  // 直接檢查是否在legalNames中
  if (legalNames && legalNames.includes(inputName)) {
    return inputName
  }

  // 模糊匹配：找包含此名稱的法律
  if (legalNames) {
    const fuzzyMatch = legalNames.find(name =>
      name.includes(inputName) || inputName.includes(name)
    )
    if (fuzzyMatch) {
      return fuzzyMatch
    }
  }

  return inputName // 找不到時返回原名稱
}

/**
 * 動態產生法條搜尋的正規表示式
 * @param {Array} legalNames - 法律名稱陣列
 * @param {Object} options - 配置選項
 * @returns {RegExp} - 正規表示式物件
 */
export function generateLegalArticleRegex(legalNames, options = {}) {
  const {
    caseSensitive = false,        // 是否區分大小寫
    matchWholeWord = true,        // 是否匹配完整詞彙
    captureGroups = true,         // 是否使用捕獲群組
    allowSpaces = true,           // 是否允許空格
    supportSubsections = true     // 是否支援項、款、目等細分
  } = options

  // 對法律名稱進行轉義，避免特殊字符影響正規表示式
  const escapedNames = legalNames.map(name =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )

  // 建立法律名稱的選擇群組
  const legalNamesPattern = escapedNames.join('|')

  // 建立條文號碼模式 (支援中文數字和阿拉伯數字，以及條之X的模式)
  const articleNumberPattern = `${CHINESE_NUMBERS}+(?:\\s*條之\\s*${CHINESE_NUMBERS}+)?`

  // 建立項、款、目模式（可選）
  const subsectionPattern = supportSubsections ?
    `(?:第\\s*(${CHINESE_NUMBERS}+(?:\\s*項第\\s*${CHINESE_NUMBERS}+)*?)\\s*[項款目])?` : ''

  // 建立基本模式
  let pattern

  if (captureGroups) {
    // 使用捕獲群組，方便提取法律名稱和條文號碼
    if (allowSpaces) {
      pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(${legalNamesPattern})第\\s*(${articleNumberPattern})\\s*條${subsectionPattern}`
    } else {
      pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(${legalNamesPattern})第(${articleNumberPattern})條${subsectionPattern}`
    }
  } else {
    // 不使用捕獲群組，只做匹配
    if (allowSpaces) {
      pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(?:${legalNamesPattern})第\\s*${articleNumberPattern}\\s*條${subsectionPattern}`
    } else {
      pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(?:${legalNamesPattern})第${articleNumberPattern}條${subsectionPattern}`
    }
  }

  // 如果需要匹配完整詞彙，添加詞邊界
  if (matchWholeWord) {
    pattern = `\\b${pattern}\\b`
  }

  // 建立正規表示式選項
  const flags = caseSensitive ? 'g' : 'gi'

  return new RegExp(pattern, flags)
}

/**
 * 台灣法律模式集合
 */
export class TaiwanLegalPatterns {
  constructor() {
    this.patterns = {
      // 司法院大法官解釋: 釋字第748號, 釋字 748, 釋字 No. 748
      interpretation: new RegExp(`釋字(?:\\s*No\\.|\\s*第|\\s+)?\\s*(${CHINESE_NUMBER_PATTERN})\\s*(?:號)?`, 'g'),

      // 民法第184條第1項 - specific law + article + subsections (dynamically generated)
      dynamic_law_articles: null, // Will be dynamically generated

      // 民法第184條 - specific law + article only (dynamically generated)
      simple_law_articles: null, // Will be dynamically generated

      // 民法 184, 民法 184-1 - short format (dynamically generated)
      short_law_articles: null, // Will be dynamically generated

      // 民法 - just law names (dynamically generated)
      law_name_only: null, // Will be dynamically generated

      // 第271條之1第1項 - sub-articles with 之: 第X條之X第X項
      // Only match if not preceded by a law name (法/條例/規則/辦法/細則)
      subarticle_pattern: new RegExp(`(?<![法例則])\\s*第\\s*(${CHINESE_NUMBER_PATTERN})\\s*條之\\s*(${CHINESE_NUMBER_PATTERN})(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*項)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*款)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*目)?`, 'g'),

      // 第184條, 第四條 - generic articles with complex structure
      // Only match standalone articles not preceded by a law name ending character
      universal_legal_pattern: new RegExp(`(?<![法例則])\\s*第\\s*(${CHINESE_NUMBER_PATTERN})\\s*條(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*項)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*款)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*目)?|(?<![法例則條])\\s*第\\s*(${CHINESE_NUMBER_PATTERN})\\s*([項款目])`, 'g'),

      // 第四條 - simple standalone articles (fallback)
      // Only match if not preceded by law name endings
      simple_article_only: /(?<![法例則])\s*第\s*([一二三四五六七八九十百千萬0-9０-９]+)\s*條/g,
    }
  }

  /**
   * 動態生成法律模式
   * @param {Array} legalNamesArray - 法律名稱陣列
   */
  generateDynamicPatterns(legalNamesArray) {
    if (!legalNamesArray || legalNamesArray.length === 0) return

    // 先擴展別名字典
    expandLawAliases(legalNamesArray)

    // 收集所有法律名稱（包含別名）
    const allLawNames = new Set()

    // 添加原始法律名稱
    legalNamesArray.forEach(name => allLawNames.add(name))

    // 添加所有別名
    Object.keys(LAW_ALIASES).forEach(alias => allLawNames.add(alias))

    // 對法律名稱進行轉義，避免特殊字符影響正規表示式
    const escapedNames = Array.from(allLawNames).map(name =>
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )

    // 按長度排序，較長的名稱優先匹配
    escapedNames.sort((a, b) => b.length - a.length)

    // 建立法律名稱的選擇群組
    const legalNamesPattern = escapedNames.join('|')

    // 建立基本條文模式
    const articleNumberPattern = `${CHINESE_NUMBER_PATTERN}(?:\\s*條之\\s*${CHINESE_NUMBER_PATTERN})?`

    // 建立項款目模式
    const subsectionPattern = `(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*項)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*款)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*目)?`

    // 動態添加所有法律的基本模式 - 允許法律名稱和"第"之間有可選空格
    this.patterns.dynamic_law_articles = new RegExp(
      `(${legalNamesPattern})\\s*第\\s*(${articleNumberPattern})\\s*條${subsectionPattern}`,
      'g'
    )

    // 新增僅法律名稱+條文的模式（沒有項款目）- 允許法律名稱和"第"之間有可選空格
    this.patterns.simple_law_articles = new RegExp(
      `(${legalNamesPattern})\\s*第\\s*(${articleNumberPattern})\\s*條(?!\\s*第)`,
      'g'
    )

    // 新增簡短格式：法律名稱 + 空格 + 條文號碼 (民法 184, 民法 184-1)
    // 必須有空格以區分 "民法184" (可能是誤植) 或 "民法 184"
    // 並且限制後面不能緊接 "年" (避免匹配 "民法 100年 修訂")
    // 增加 (?!${CHINESE_NUMBERS}) 防止回溯匹配 partial numbers (e.g. 100年 -> match 10)
    this.patterns.short_law_articles = new RegExp(
      `(${legalNamesPattern})\\s+(${CHINESE_NUMBER_PATTERN}(?:[-‐–]${CHINESE_NUMBER_PATTERN})?)(?!${CHINESE_NUMBERS}|\\s*[年])`,
      'g'
    )

    // 新增法律名稱本身的高亮模式 - 只有當後面不跟著"第"時才匹配（包含可選空格）
    this.patterns.law_name_only = new RegExp(
      `(${legalNamesPattern})(?!\\s*第)`,
      'g'
    )

    console.log('動態生成法律模式完成，涵蓋', legalNamesArray.length, '個法律名稱 +', Object.keys(LAW_ALIASES).length, '個別名')
  }

  /**
   * 取得所有模式
   * @returns {Object} - 模式物件
   */
  getPatterns() {
    return this.patterns
  }

  /**
   * 取得處理順序（由具體到一般）
   * @returns {Array} - 模式鍵值陣列
   */
  getProcessingOrder() {
    return [
      'interpretation',
      'dynamic_law_articles',
      'simple_law_articles',
      'short_law_articles',
      'law_name_only',
      'subarticle_pattern',
      'universal_legal_pattern',
      'simple_article_only'
    ]
  }
}

// 導出別名相關函數
export { LAW_ALIASES, REVERSE_LAW_ALIASES, expandLawAliases, createSimplifiedLawName }