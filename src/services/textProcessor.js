/**
 * 文字處理服務 - 負責中英文數字轉換、法條拆分等功能
 */

// 中文數字對應表
const CHINESE_NUMS = {
  '零': 0, '○': 0,
  '一': 1, '壹': 1,
  '二': 2, '貳': 2,
  '三': 3, '參': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陸': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9
}

// 中文單位對應表
const CHINESE_UNITS = {
  '十': 10, '拾': 10,
  '百': 100, '佰': 100,
  '千': 1000, '仟': 1000,
  '萬': 10000
}

/**
 * 將全形數字轉換為半形數字
 * @param {string} str - 輸入字串
 * @returns {string} - 轉換後的字串
 */
export function toHalfWidthDigits(str) {
  return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30))
}

/**
 * 將中文數字轉換為阿拉伯數字
 * @param {string} str - 包含中文數字的字串
 * @returns {string} - 轉換後的字串
 */
export function chineseToArabic(str) {
  // 解析中文數字字串
  function parseChineseNumber(s) {
    let result = 0
    let unit = 1
    let num = 0
    let lastUnit = false
    
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      
      if (CHINESE_UNITS[c]) {
        unit = CHINESE_UNITS[c]
        if (num === 0) num = 1 // 例如 "十" = 10
        result += num * unit
        num = 0
        lastUnit = true
      } else if (CHINESE_NUMS[c] !== undefined) {
        num = CHINESE_NUMS[c]
        if (lastUnit) {
          // 例如 "一百一"
          result += num
          num = 0
          lastUnit = false
        }
      }
    }
    
    if (num > 0) result += num
    return result
  }

  // 替換複合中文數字（如一千二百三十四）
  str = str.replace(/([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[千仟]?([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[百佰])?([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[十拾])?[壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4})/g, (match) => {
    if (!match) return match
    
    // 只有包含單位的才轉換
    if (/[十拾百佰千仟萬]/.test(match)) {
      const num = parseChineseNumber(match)
      return num > 0 ? num.toString() : match
    }
    return match
  })

  // 替換單個中文數字（如一八四 -> 184）
  str = str.replace(/[壹貳參肆伍陸柒捌玖一二三四五六七八九零○]/g, c => 
    CHINESE_NUMS[c] !== undefined ? CHINESE_NUMS[c] : c
  )

  return str
}

/**
 * 將由「及」連接的法條引用拆分成獨立實體
 * @param {string} text - 包含連接法條的文字
 * @returns {Array} - 拆分結果陣列
 */
export function splitConnectedCitations(text) {
  const splits = []

  // 匹配由「及」連接的複雜法條引用模式
  const connectedPattern = /(第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+(?:\s*條之\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+)?\s*條(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*項)?(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*[款目])?)及(第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+(?:\s*[項款目]|(?:\s*條(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*項)?(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*[款目])?)))/g

  let lastIndex = 0
  let match

  while ((match = connectedPattern.exec(text)) !== null) {
    // 添加匹配前的文字
    if (match.index > lastIndex) {
      splits.push({
        text: text.substring(lastIndex, match.index),
        originalStart: lastIndex,
        isSplit: false
      })
    }

    // 拆分匹配的引用
    const fullMatch = match[0]
    const firstPart = match[1]  // "及" 之前的部分
    const secondPart = match[2] // "及" 之後的部分

    const matchStart = match.index
    const conjunctionIndex = fullMatch.indexOf('及')

    // 添加第一部分
    splits.push({
      text: firstPart,
      originalStart: matchStart,
      isSplit: true
    })

    // 添加第二部分
    splits.push({
      text: secondPart,
      originalStart: matchStart + conjunctionIndex + 1, // +1 跳過「及」字
      isSplit: true
    })

    lastIndex = match.index + match[0].length
  }

  // 添加剩餘文字
  if (lastIndex < text.length) {
    splits.push({
      text: text.substring(lastIndex),
      originalStart: lastIndex,
      isSplit: false
    })
  }

  // 如果沒有找到分割，返回原始文字
  if (splits.length === 0) {
    return [{
      text: text,
      originalStart: 0,
      isSplit: false
    }]
  }

  return splits
}

/**
 * 正規化文字，統一數字格式
 * @param {string} text - 輸入文字
 * @returns {string} - 正規化後的文字
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return ''
  
  // 先轉換全形數字為半形
  let normalized = toHalfWidthDigits(text)
  
  // 再轉換中文數字為阿拉伯數字
  normalized = chineseToArabic(normalized)
  
  return normalized
}

/**
 * 檢查文字是否包含法律相關關鍵字
 * @param {string} text - 輸入文字
 * @returns {boolean} - 是否包含法律關鍵字
 */
export function containsLegalKeywords(text) {
  if (!text || typeof text !== 'string') return false
  
  const legalKeywords = /[字號釋憲判第度年條項款目法]/
  return legalKeywords.test(text)
}

/**
 * 清理和轉義 HTML 字符
 * @param {string} str - 輸入字串
 * @returns {string} - 轉義後的字串
 */
export function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 生成法律引用的唯一標識符
 * @param {Object} data - 法律資料物件
 * @returns {string} - 唯一標識符
 */
export function generateLawIdentifier(data) {
  const { legalType, caseType, lawName, article, paragraph, year, number } = data
  
  if (legalType === 'law_article' && lawName && article) {
    return `${lawName}第${article}條${paragraph ? `第${paragraph}項` : ''}`
  } else if (caseType === '釋字' && number) {
    return `釋字第${number}號`
  } else if (year && caseType && number) {
    return `${year}年${caseType}字第${number}號`
  } else {
    return `unknown_${Date.now()}`
  }
}