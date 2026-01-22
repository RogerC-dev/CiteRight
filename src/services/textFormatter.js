/**
 * 文字格式化服務 - 負責將法律文件文字轉換為段落分明的 HTML 格式
 * Text Formatter Service - Converts legal document text to well-formatted HTML with clear paragraphs
 */

/**
 * 格式化文字為段落分明的 HTML
 * Formats text into HTML with clear paragraph breaks
 * 
 * @param {string} text - 輸入的文字內容
 * @returns {string} - 格式化後的 HTML
 */
export function formatParagraphs(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // 如果已經是 HTML，先提取純文字或直接處理
  const isHtml = /<[^>]+>/.test(text)
  
  if (isHtml) {
    // 對於 HTML 內容，提取純文字內容
    // 移除所有 HTML 標籤，保留文字內容
    const plainText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return formatPlainTextToParagraphs(plainText)
  }

  return formatPlainTextToParagraphs(text)
}

/**
 * 將純文字格式化為段落
 * Formats plain text into paragraphs
 * 
 * @param {string} text - 純文字內容
 * @returns {string} - 格式化後的 HTML
 */
function formatPlainTextToParagraphs(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // 清理文字：移除多餘的空白字符，但保留換行
  let cleaned = text
    .replace(/\r\n/g, '\n')  // 統一換行符
    .replace(/\r/g, '\n')
    .trim()

  // 如果文字為空，返回空字串
  if (!cleaned) {
    return ''
  }

  // 分割段落的多種策略
  const paragraphs = []

  // 策略 0: 優先檢測行首的阿拉伯數字（1, 2, 3 等）- 匹配官方網站風格
  // 關鍵：只檢測行首的數字，不檢測段落中間的數字
  // 檢測模式：行首的數字（可選句號或空格），例如 "1 ", "2 ", "1.", "2." 等
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l)
  
  // 檢測行首的數字模式（必須在行開始位置）
  const lineStartNumberPattern = /^\d+[\.。、]?\s+/
  const hasLineStartNumbers = lines.some(line => lineStartNumberPattern.test(line))
  
  if (hasLineStartNumbers && lines.length > 1) {
    // 按行分割，但需要智能處理：
    // - 行首有數字的行 = 新段落開始
    // - 行首沒有數字的行 = 可能是前一段落的延續（如果很短）或新段落（如果很長）
    let currentParagraph = ''
    
    lines.forEach((line, index) => {
      const isNumberedLine = lineStartNumberPattern.test(line)
      
      if (isNumberedLine) {
        // 行首有數字，開始新段落
        // 先保存前一個段落（如果有）
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim())
        }
        currentParagraph = line
      } else {
        // 行首沒有數字，判斷是否為前一段落的延續
        // 如果當前段落為空或行很短（可能是標題或短句），則開始新段落
        // 否則合併到當前段落
        if (!currentParagraph || line.length < 30) {
          // 短行或新段落開始
          if (currentParagraph.trim()) {
            paragraphs.push(currentParagraph.trim())
          }
          currentParagraph = line
        } else {
          // 長行，合併到當前段落（保留段落內的換行，但用空格連接）
          currentParagraph += ' ' + line
        }
      }
    })
    
    // 添加最後一個段落
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim())
    }
  } else {
    // 策略 1: 檢測行首的中文數字（一、二、三、等）- 但只在明確的列表結構中
    // 注意：不要在中間段落中斷開中文數字
    const linesForChinese = cleaned.split('\n').map(l => l.trim()).filter(l => l)
    const chineseNumAtLineStart = /^[一二三四五六七八九十百千萬]+[、。]\s+/
    const hasChineseNumAtStart = linesForChinese.some(line => chineseNumAtLineStart.test(line))
    
    if (hasChineseNumAtStart && linesForChinese.length > 2) {
      // 只有在多行且每行開頭都有中文數字時才分割
      const allStartWithChinese = linesForChinese.filter(l => l).every(line => 
        chineseNumAtLineStart.test(line) || line.length < 50
      )
      
      if (allStartWithChinese) {
        // 按行分割
        linesForChinese.forEach(line => {
          if (line.trim()) {
            paragraphs.push(line.trim())
          }
        })
      } else {
        // 不是所有行都符合模式，使用雙換行符或智能合併
        const doubleNewlinePattern = /\n\s*\n/
        if (doubleNewlinePattern.test(cleaned)) {
          paragraphs.push(...cleaned.split(doubleNewlinePattern).map(p => p.trim()).filter(p => p))
        } else {
          // 智能合併：保留整個文字作為段落
          paragraphs.push(cleaned)
        }
      }
    } else {
      // 策略 2: 按雙換行符分割
      const doubleNewlinePattern = /\n\s*\n/
      if (doubleNewlinePattern.test(cleaned)) {
        paragraphs.push(...cleaned.split(doubleNewlinePattern).map(p => p.trim()).filter(p => p))
      } else {
        // 策略 3: 檢查是否有明顯的段落結構
        const linesForPattern = cleaned.split('\n').map(l => l.trim()).filter(l => l)
        
        // 如果行數較少，可能是單一段落
        if (linesForPattern.length <= 3) {
          paragraphs.push(cleaned)
        } else {
          // 檢查是否有重複的模式（如每行開頭有數字或標記）
          const hasPattern = linesForPattern.some(line => 
            /^\d+[\.。、]\s/.test(line) ||
            /^\d+\s+/.test(line) ||  // 檢測 "1 ", "2 " 等模式
            /^第\d+條/.test(line)
          )

          if (hasPattern) {
            // 有模式，按行分割
            paragraphs.push(...linesForPattern)
          } else {
            // 沒有明顯模式，嘗試智能合併
            // 合併短行（少於 20 字符）到前一行
            const merged = []
            let current = ''
            
            linesForPattern.forEach(line => {
              if (line.length < 20 && current) {
                // 短行，合併到當前段落
                current += ' ' + line
              } else {
                // 長行，開始新段落
                if (current) {
                  merged.push(current)
                }
                current = line
              }
            })
            
            if (current) {
              merged.push(current)
            }
            
            paragraphs.push(...merged)
          }
        }
      }
    }
  }

  // 如果沒有找到任何段落，將整個文字作為一個段落
  if (paragraphs.length === 0) {
    paragraphs.push(cleaned)
  }

  // 將段落轉換為 HTML，並清理每個段落
  const htmlParagraphs = paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // 轉義 HTML 特殊字符（但保留已存在的標籤）
      const escaped = escapeHtmlSpecialChars(p)
      // 將單個換行符轉換為空格（段落內）
      const normalized = escaped.replace(/\n+/g, ' ').replace(/\s+/g, ' ')
      return `<p class="legal-paragraph">${normalized}</p>`
    })

  return htmlParagraphs.join('')
}

/**
 * 轉義 HTML 特殊字符（但保留已存在的 HTML 標籤）
 * Escapes HTML special characters while preserving existing HTML tags
 * 
 * @param {string} text - 輸入文字
 * @returns {string} - 轉義後的文字
 */
function escapeHtmlSpecialChars(text) {
  // 如果已經包含 HTML 標籤，不進行轉義
  if (/<[^>]+>/.test(text)) {
    return text
  }

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 格式化法律條文內容
 * Formats law article content with paragraph breaks
 * 
 * @param {string} articleContent - 條文內容
 * @returns {string} - 格式化後的 HTML
 */
export function formatLawArticle(articleContent) {
  if (!articleContent || typeof articleContent !== 'string') {
    return ''
  }

  let content = articleContent.trim()

  // 步驟 1: 優先處理中文數字列表（一、二、三、四、五等）
  // 檢測模式：中文數字 + 頓號或句號，例如 "一、"、"二、"、"三。"
  // 確保每個列表項都在新行開始
  const chineseListPattern = /([一二三四五六七八九十]+[、。])/g
  
  // 檢查是否包含中文數字列表
  const chineseListMatches = [...content.matchAll(chineseListPattern)]
  
  if (chineseListMatches.length > 0) {
    // 在每個中文數字標記前插入換行符（如果前面沒有換行）
    // 這樣可以確保每個列表項都在新行開始
    content = content.replace(chineseListPattern, (match, p1, offset) => {
      // 檢查前面是否有換行符或是否在文字開頭
      const beforeMatch = content.substring(Math.max(0, offset - 2), offset)
      if (offset === 0 || /\n/.test(beforeMatch)) {
        // 已經有換行或是在開頭，直接返回
        return match
      } else {
        // 前面沒有換行，插入換行符
        return '\n' + match
      }
    })
  }

  // 步驟 2: 處理結構標記（第X項、第X款、第X目）
  // 這些是法律條文的主要結構，應該換段落
  const structuralMarkers = /(第[一二三四五六七八九十百千萬\d]+[項款目])/g
  const hasStructuralMarkers = structuralMarkers.test(content)
  
  if (hasStructuralMarkers) {
    // 重置正則表達式
    structuralMarkers.lastIndex = 0
    // 在結構標記前插入換行符（如果前面沒有）
    content = content.replace(structuralMarkers, (match, p1, offset) => {
      const beforeMatch = content.substring(Math.max(0, offset - 2), offset)
      if (offset === 0 || /\n/.test(beforeMatch)) {
        return match
      } else {
        return '\n' + match
      }
    })
  }

  // 步驟 3: 使用基本段落格式化處理（會將換行轉換為段落）
  let formatted = formatParagraphs(content)
  
  // 如果格式化後沒有產生段落，使用備用方案
  if (!formatted || formatted === '<p class="legal-paragraph"></p>' || !formatted.includes('</p>')) {
    // 備用方案：直接處理結構標記為段落
    let backupContent = articleContent.trim()
    
    if (hasStructuralMarkers) {
      structuralMarkers.lastIndex = 0
      backupContent = backupContent.replace(structuralMarkers, '</p><p class="legal-paragraph">$1')
      
      // 包裝在段落標籤中
      if (!backupContent.startsWith('<p')) {
        backupContent = '<p class="legal-paragraph">' + backupContent
      }
      if (!backupContent.endsWith('</p>')) {
        backupContent = backupContent + '</p>'
      }
      
      // 清理多餘的段落標籤
      backupContent = backupContent.replace(/<\/p>\s*<p[^>]*>/g, '</p><p class="legal-paragraph">')
      
      // 移除開頭和結尾的空段落
      backupContent = backupContent.replace(/^<p[^>]*>\s*<\/p>/, '')
      backupContent = backupContent.replace(/<p[^>]*>\s*<\/p>$/, '')
      
      formatted = backupContent
    } else {
      // 如果沒有結構標記，使用基本格式化
      formatted = formatParagraphs(articleContent)
    }
  }

  // 如果格式化後沒有內容，返回基本段落
  if (!formatted || formatted.trim() === '' || formatted === '<p class="legal-paragraph"></p>') {
    return formatParagraphs(articleContent)
  }

  return formatted
}

/**
 * 格式化釋字內容
 * Formats interpretation content with paragraph breaks
 * 
 * @param {string} content - 釋字內容
 * @returns {string} - 格式化後的 HTML
 */
export function formatInterpretationText(content) {
  if (!content || typeof content !== 'string') {
    return ''
  }

  // 釋字內容通常較長，需要更細緻的段落處理
  return formatParagraphs(content)
}
