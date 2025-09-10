// content.js - 台灣法源探測器 (CiteRight)
// 整合台灣法律資料庫，支援法條、釋字、判決自動識別

// 內嵌必要的函數以避免ES6模組問題

/**
 * 動態產生法條搜尋的正規表示式
 */
function generateLegalArticleRegex(legalNames, options = {}) {
    const {
        caseSensitive = false,        // 是否區分大小寫
        matchWholeWord = true,        // 是否匹配完整詞彙
        captureGroups = true,         // 是否使用捕獲群組
        allowSpaces = true,           // 是否允許空格
        supportSubsections = true     // 是否支援項、款、目等細分
    } = options;

    // 對法律名稱進行轉義，避免特殊字符影響正規表示式
    const escapedNames = legalNames.map(name =>
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // 建立法律名稱的選擇群組
    const legalNamesPattern = escapedNames.join('|');

    // 建立條文號碼模式 (支援中文數字和阿拉伯數字，以及條之X的模式)
    const articleNumberPattern = `${CHINESE_NUMBERS}+(?:\\s*條之\\s*${CHINESE_NUMBERS}+)?`;
    
    // 建立項、款、目模式（可選）- 整個項款目作為一個捕獲群組
    const subsectionPattern = supportSubsections ? 
        `(?:第\\s*(${CHINESE_NUMBERS}+(?:\\s*項第\\s*${CHINESE_NUMBERS}+)*?)\\s*[項款目])?` : '';

    // 建立基本模式
    let pattern;

    if (captureGroups) {
        // 使用捕獲群組，方便提取法律名稱和條文號碼
        if (allowSpaces) {
            pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(${legalNamesPattern})第\\s*(${articleNumberPattern})\\s*條${subsectionPattern}`;
        } else {
            pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(${legalNamesPattern})第(${articleNumberPattern})條${subsectionPattern}`;
        }
    } else {
        // 不使用捕獲群組，只做匹配
        if (allowSpaces) {
            pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(?:${legalNamesPattern})第\\s*${articleNumberPattern}\\s*條${subsectionPattern}`;
        } else {
            pattern = `(?<![根據依按與宣告，以及及不符主管機關基於甲因酒駕違反])(?:${legalNamesPattern})第${articleNumberPattern}條${subsectionPattern}`;
        }
    }

    // 如果需要匹配完整詞彙，添加詞邊界
    if (matchWholeWord) {
        pattern = `\\b${pattern}\\b`;
    }

    // 建立正規表示式選項
    const flags = caseSensitive ? 'g' : 'gi';

    return new RegExp(pattern, flags);
}

/**
 * 從JSON資料載入法律名稱
 */
function loadLegalNamesFromJson(jsonData) {
    let data;

    if (typeof jsonData === 'string') {
        data = JSON.parse(jsonData);
    } else {
        data = jsonData;
    }

    if (Array.isArray(data)) {
        if (typeof data[0] === 'string') {
            return data;
        } else if (typeof data[0] === 'object' && data[0].name) {
            return data.map(item => item.name);
        }
    } else if (data.laws && Array.isArray(data.laws)) {
        return data.laws;
    } else if (data.legalNames && Array.isArray(data.legalNames)) {
        return data.legalNames;
    }

    throw new Error('無法解析JSON結構，請確認格式正確');
}

// 從Law.json載入法律名稱並產生動態正規表示式
let legalNames, dynamicLegalArticleRegex;

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
    
    // 大法官相關法律 (新增)
    '大法官審理案件法': ['司法院大法官審理案件法'],
    '司法院大法官審理案件法施行細則': ['司法院大法官審理案件法施行細則'],

    // 國安相關法律 (新增)
    '國家安全法': ['國家安全法'],
    '社會秩序維護法': ['社會秩序維護法'],

    // 其他常見別名
    '著作權法': ['著作權法'],
    '專利法': ['專利法'],
    '商標法': ['商標法'],
    '消保法': ['消費者保護法'],
    '個資法': ['個人資料保護法'],
    '健保法': ['全民健康保險法']
};

// 反向別名字典 - 全稱對應到簡稱（將在初始化時建立）
let REVERSE_LAW_ALIASES = {};

// 建立法律別名的反向對應
function buildReverseLawAliases() {
    REVERSE_LAW_ALIASES = {};
    for (const [shortName, fullNames] of Object.entries(LAW_ALIASES)) {
        for (const fullName of fullNames) {
            REVERSE_LAW_ALIASES[fullName] = shortName;
        }
    }
}

// 根據Law.json內容動態擴展別名字典
function expandLawAliases(legalNamesArray) {
    buildReverseLawAliases();
    
    // 為每個Law.json中的法律名稱檢查是否需要建立別名
    for (const lawName of legalNamesArray) {
        // 檢查是否已有反向對應
        if (!REVERSE_LAW_ALIASES[lawName]) {
            // 嘗試建立常見的簡化對應
            const simplifiedName = createSimplifiedLawName(lawName);
            if (simplifiedName && simplifiedName !== lawName) {
                if (!LAW_ALIASES[simplifiedName]) {
                    LAW_ALIASES[simplifiedName] = [];
                }
                if (!LAW_ALIASES[simplifiedName].includes(lawName)) {
                    LAW_ALIASES[simplifiedName].push(lawName);
                }
                REVERSE_LAW_ALIASES[lawName] = simplifiedName;
            }
        }
    }
    
    console.log('✅ 法條別名字典擴展完成，共', Object.keys(LAW_ALIASES).length, '個別名對應');
}

// 創建簡化的法律名稱
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
        .replace(/^監察院/, '');
    
    // 移除常見的後綴詞但保留核心
    simplified = simplified
        .replace(/施行細則$/, '')
        .replace(/實施辦法$/, '')
        .replace(/管理辦法$/, '')
        .replace(/作業辦法$/, '');
    
    // 如果簡化後太短或沒變化，返回null
    if (simplified.length < 2 || simplified === fullName) {
        return null;
    }
    
    return simplified;
}

// 查找法律的標準名稱（從Law.json中的實際名稱）
function findStandardLawName(inputName) {
    // 先檢查是否為別名
    if (LAW_ALIASES[inputName]) {
        // 返回在legalNames中找到的第一個匹配名稱
        for (const candidate of LAW_ALIASES[inputName]) {
            if (legalNames && legalNames.includes(candidate)) {
                return candidate;
            }
        }
    }
    
    // 直接檢查是否在legalNames中
    if (legalNames && legalNames.includes(inputName)) {
        return inputName;
    }
    
    // 模糊匹配：找包含此名稱的法律
    if (legalNames) {
        const fuzzyMatch = legalNames.find(name => 
            name.includes(inputName) || inputName.includes(name)
        );
        if (fuzzyMatch) {
            return fuzzyMatch;
        }
    }
    
    return inputName; // 找不到時返回原名稱
}

// 動態生成額外的法律模式
function generateDynamicPatterns(legalNamesArray) {
    if (!legalNamesArray || legalNamesArray.length === 0) return;
    
    // 先擴展別名字典
    expandLawAliases(legalNamesArray);
    
    // 收集所有法律名稱（包含別名）
    const allLawNames = new Set();
    
    // 添加原始法律名稱
    legalNamesArray.forEach(name => allLawNames.add(name));
    
    // 添加所有別名
    Object.keys(LAW_ALIASES).forEach(alias => allLawNames.add(alias));
    
    // 對法律名稱進行轉義，避免特殊字符影響正規表示式
    const escapedNames = Array.from(allLawNames).map(name =>
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    // 按長度排序，較長的名稱優先匹配（避免 "憲法" 搶先匹配 "中華民國憲法"）
    escapedNames.sort((a, b) => b.length - a.length);
    
    // 建立法律名稱的選擇群組
    const legalNamesPattern = escapedNames.join('|');
    
    // 建立基本條文模式 - 使用改進的中文數字模式
    const articleNumberPattern = `${CHINESE_NUMBER_PATTERN}(?:\\s*條之\\s*${CHINESE_NUMBER_PATTERN})?`;

    // 建立項款目模式 - 使用改進的中文數字模式
    const subsectionPattern = `(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*項)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*款)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*目)?`;

    // 動態添加所有法律的基本模式
    TAIWAN_LEGAL_PATTERNS.dynamic_law_articles = new RegExp(
        `(${legalNamesPattern})第\\s*(${articleNumberPattern})\\s*條${subsectionPattern}`, 
        'g'
    );
    
    // 新增僅法律名稱+條文的模式（沒有項款目），優先級高於dynamic_law_articles
    TAIWAN_LEGAL_PATTERNS.simple_law_articles = new RegExp(
        `(${legalNamesPattern})第\\s*(${articleNumberPattern})\\s*條(?![第])`, 
        'g'
    );
    
    // 新增法律名稱本身的高亮模式
    TAIWAN_LEGAL_PATTERNS.law_name_only = new RegExp(
        `(${legalNamesPattern})(?![第])`,
        'g'
    );

    console.log('✅ 動態生成法律模式完成，涵蓋', legalNamesArray.length, '個法律名稱 +', Object.keys(LAW_ALIASES).length, '個別名');
    
    // 調試：顯示一些別名對應的例子
    const aliasExamples = ['憲法', '民法', '刑法', '集會遊行法', '消保法', '個資法'].map(alias => {
        const standard = findStandardLawName(alias);
        return `${alias} → ${standard}`;
    });
    console.log('📋 別名對應示例:', aliasExamples.join(', '));
    
}

// 暴露給全域以便調试
if (typeof window !== 'undefined') {
    window.debugLawAliases = function() {
        console.log('🔍 法律別名字典:', LAW_ALIASES);
        console.log('🔄 反向別名字典:', REVERSE_LAW_ALIASES);
        console.log('📚 已載入法律數量:', legalNames ? legalNames.length : 0);
    };
}

// 使用fetch異步載入Law.json
(async function initializeLegalData() {
    try {
        const response = await fetch(chrome.runtime.getURL('scripts/Law.json'));
        const legalNamesData = await response.json();
        legalNames = loadLegalNamesFromJson(legalNamesData);
        dynamicLegalArticleRegex = generateLegalArticleRegex(legalNames, {
            caseSensitive: false,
            matchWholeWord: false,
            captureGroups: true,
            allowSpaces: true,
            supportSubsections: true
        });
        
        // 動態生成額外的法律模式
        generateDynamicPatterns(legalNames);
        
        console.log('✅ 法律資料載入完成，共', legalNames.length, '個法律名稱');
        
        // 法律資料載入完成後，重新執行 highlighting
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => highlightCitations(), 100);
            });
        } else {
            setTimeout(() => highlightCitations(), 100);
        }
    } catch (error) {
        console.error('❌ 載入法律資料失敗:', error);
        // 使用fallback資料 - 添加基本法律名稱
        legalNames = [
            // 基本憲法
            '中華民國憲法', '憲法', '憲法增修條文',
            // 基本民刑法
            '民法', '中華民國刑法', '刑法',
            // 程序法
            '行政程序法', '民事訴訟法', '刑事訴訟法', '行政訴訟法',
            // 常見特別法
            '集會遊行法', '公司法', '勞動基準法', '勞基法',
            '消費者保護法', '消保法', '個人資料保護法', '個資法',
            '所得稅法', '營業稅法', '土地法', '建築法',
            '著作權法', '專利法', '商標法', '公平交易法',
            // 行政相關
            '國家安全法', '社會秩序維護法', '警察法',
            '都市計畫法', '環境保護法', '文化資產保存法'
        ];
        dynamicLegalArticleRegex = generateLegalArticleRegex(legalNames, {
            caseSensitive: false,
            matchWholeWord: false,
            captureGroups: true,
            allowSpaces: true,
            supportSubsections: true
        });
        
        // 為fallback資料也生成動態模式
        generateDynamicPatterns(legalNames);
        console.log('⚠️ 使用預設法律資料');
        
        // 預設資料載入完成後，重新執行 highlighting
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => highlightCitations(), 100);
            });
        } else {
            setTimeout(() => highlightCitations(), 100);
        }
    }
})();

// 統一的中文數字字符集 - 擴展以支援更複雜的數字組合
const CHINESE_NUMBERS = '[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]';

// 更精確的中文數字模式，支援十以上的數字 - FIXED VERSION
const CHINESE_NUMBER_PATTERN = '(?:[0-9０-９]+|[一二三四五六七八九十拾壹貳參肆伍陸柒捌玖拾百佰千仟萬億兆零]+|二十[一二三四五六七八九]?|三十[一二三四五六七八九]?|[一二三四五六七八九]?十[一二三四五六七八九]?)';

const TAIWAN_LEGAL_PATTERNS = {
    // 司法院大法官解釋: 釋字第748號
    interpretation: /釋字第\s*([0-9０-９]+)\s*號/g,

    // 法律名稱本身的高亮（新增）
    law_name_only: null, // Will be dynamically generated

    // 法條引用: 使用動態生成的正規表示式，支援從Law.json載入的所有法律名稱
    law_article: null,

    // 統一法條組合模式: 匹配所有可能的 第X條/項/款/目 組合 (無語境限制) - SIMPLIFIED AND FIXED
    universal_legal_pattern: new RegExp(`第\\s*(${CHINESE_NUMBER_PATTERN})\\s*條(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*項)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*款)?(?:第\\s*(${CHINESE_NUMBER_PATTERN})\\s*目)?|第\\s*(${CHINESE_NUMBER_PATTERN})\\s*([項款目])`, 'g'),

    // Add a simpler backup pattern for basic articles
    simple_article_only: /第\s*([一二三四五六七八九十百千萬0-9０-９]+)\s*條/g,
};

// 調試：檢查模式創建
console.log('🔍 CHINESE_NUMBER_PATTERN:', CHINESE_NUMBER_PATTERN);
console.log('🔍 universal_legal_pattern:', TAIWAN_LEGAL_PATTERNS.universal_legal_pattern);

function toHalfWidthDigits(str) {
    return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30));
}

function chineseToArabic(str) {
    // Convert Chinese numerals to Arabic numerals (robust version)
    const chineseNums = {
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
    };
    const units = {
        '十': 10, '拾': 10,
        '百': 100, '佰': 100,
        '千': 1000, '仟': 1000,
        '萬': 10000
    };

    // Helper to parse a Chinese number string
    function parseChineseNumber(s) {
        let result = 0;
        let unit = 1;
        let num = 0;
        let lastUnit = false;
        for (let i = 0; i <=s.length - 1; i++) {
            const c = s[i];
            if (units[c]) {
                unit = units[c];
                if (num === 0) num = 1; // e.g. 十 = 10
                result += num * unit;
                num = 0;
                lastUnit = true;
            } else if (chineseNums[c] !== undefined) {
                num = chineseNums[c];
                if (lastUnit) {
                    // e.g. 一百一
                    result += num;
                    num = 0;
                    lastUnit = false;
                }
            }
        }
        if (num > 0) result += num;
        return result;
    }

    // Replace all Chinese number segments with Arabic numerals
    // Match segments like 一千二百三十四, 一百, 十一, 二十, etc.
    str = str.replace(/([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[千仟]?([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[百佰])?([壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4}[十拾])?[壹貳參肆伍陸柒捌玖一二三四五六七八九零○]{0,4})/g, (match) => {
        if (!match) return match;
        // Only convert if the match contains at least one unit
        if (/[十拾百佰千仟萬]/.test(match)) {
            const num = parseChineseNumber(match);
            return num > 0 ? num.toString() : match;
        }
        return match;
    });

    // Replace single digits (e.g., 一八四 -> 184)
    str = str.replace(/[壹貳參肆伍陸柒捌玖一二三四五六七八九零○]/g, c => chineseNums[c] !== undefined ? chineseNums[c] : c);

    return str;
}

// Context tracking for mixed law references
let lastLawName = '';

function makeSpan(match, key, groups) {
    let year = '', caseType = '', number = '', lawName = '', article = '', paragraph = '';

    if (key === 'interpretation') {
        caseType = '釋字';
        number = toHalfWidthDigits(groups[0]);
    } else if (key === 'law_name_only') {
        const inputLawName = groups[0]; // 匹配到的法律名稱（可能是別名）
        lawName = findStandardLawName(inputLawName); // 轉換為標準名稱
        lastLawName = lawName; // Store for mixed references
        caseType = '法律名稱';
        article = ''; // No article for law name only
        paragraph = '';
    } else if (key === 'dynamic_law_articles') {
        const inputLawName = groups[0]; // 匹配到的法律名稱（可能是別名）
        lawName = findStandardLawName(inputLawName); // 轉換為標準名稱
        lastLawName = lawName; // Store for mixed references
        article = chineseToArabic(toHalfWidthDigits(groups[1])); // 184、271條之1、一八四、三百二十
        // Build paragraph from multiple groups
        let paragraphParts = [];
        if (groups[2]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[2]))); // 項
        if (groups[3]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[3]))); // 款
        if (groups[4]) paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[4]))); // 目
        paragraph = paragraphParts.length > 0 ? '-' + paragraphParts.join('-') : '';
        caseType = '法條';
    } else if (key === 'simple_law_articles') {
        const inputLawName = groups[0]; // 匹配到的法律名稱（可能是別名）
        lawName = findStandardLawName(inputLawName); // 轉換為標準名稱
        lastLawName = lawName; // Store for mixed references
        // For simple_article_only pattern: /第\s*([一二三四五六七八九十百千萬0-9０-９]+)\s*條/g
        // groups[0] is the article number, not the law name
        lawName = lastLawName || ''; // Use the last seen law name or empty
        article = chineseToArabic(toHalfWidthDigits(groups[0])); // 條號 - groups[0] is the article number
        paragraph = ''; // 沒有項款目
        caseType = '法條';
    } else if (key === 'universal_legal_pattern') {
        lawName = lastLawName || ''; // Use the last seen law name or empty

        // 判斷是條文組合還是單獨項款目
        if (groups[1] && groups[2] === '條') {
            // 這是條文組合: 第X條[第X項][第X款][第X目]
            article = chineseToArabic(toHalfWidthDigits(groups[1])); // 條號
            let paragraphParts = [];
            if (groups[3] && groups[4] === '項') paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[3]))); // 項
            if (groups[5] && groups[6] === '款') paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[5]))); // 款
            if (groups[7] && groups[8] === '目') paragraphParts.push(chineseToArabic(toHalfWidthDigits(groups[7]))); // 目
            paragraph = paragraphParts.length > 0 ? '-' + paragraphParts.join('-') : '';
        } else if (groups[9] && groups[10]) {
            // 這是單獨項款目: 第X項/款/目
            article = ''; // No article number for standalone subsections
            const subsectionNum = chineseToArabic(toHalfWidthDigits(groups[9]));
            const subsectionType = groups[10]; // 項/款/目
            paragraph = `-${subsectionNum}`;
        }
        caseType = '法條';
    }

    // Escape HTML attributes to prevent corruption
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // Escape the match text for safe insertion
    const escapeMatch = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const result = `<span class="citeright-link" 
                data-year="${escapeHtml(year)}" 
                data-case-type="${escapeHtml(caseType)}" 
                data-number="${escapeHtml(number)}"
                data-law-name="${escapeHtml(lawName)}"
                data-article="${escapeHtml(article)}"
                data-paragraph="${escapeHtml(paragraph)}"
                data-legal-type="${escapeHtml(key)}"
                style="background-color: rgba(24, 144, 255, 0.08) !important; border-bottom: 1px solid rgba(24, 144, 255, 0.3) !important; padding: 1px 2px !important; border-radius: 2px !important; cursor: pointer !important;"
                title="按住 Ctrl 並移動滑鼠查看詳情">${escapeMatch(match)}</span>`;
    console.log('🎨 生成的高亮HTML:', result);
    return result;
}

// Helper function to check if text is already part of a highlighted element
function isAlreadyHighlighted(node, matchText) {
    // Get all existing highlighted elements in the document
    const existingHighlights = node.ownerDocument.querySelectorAll('.citeright-link');
    
    for (const highlight of existingHighlights) {
        const highlightText = highlight.textContent;
        // If the current match is a substring of an existing highlight, skip it
        if (highlightText.includes(matchText) && highlightText !== matchText) {
            // Additional check: make sure the matched text is within reasonable proximity
            // to avoid false positives across distant elements
            if (isTextInProximity(node, highlight)) {
                return true;
            }
        }
    }
    return false;
}

// Helper function to check if text node is in proximity to highlighted element
function isTextInProximity(textNode, highlightElement) {
    // Check if they share a common ancestor within reasonable depth
    let current = textNode.parentNode;
    let depth = 0;
    const maxDepth = 5; // Reasonable depth limit
    
    while (current && depth < maxDepth) {
        if (current.contains(highlightElement)) {
            return true;
        }
        current = current.parentNode;
        depth++;
    }
    return false;
}

// Helper function to remove overlapping matches, keeping longer/more specific ones
function removeOverlappingMatches(matches) {
    if (matches.length === 0) return matches;
    
    console.log(`🔍 Processing ${matches.length} matches for overlap removal`);

    // Sort by start position, then by length (longest first for same position)
    matches.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return b.text.length - a.text.length;
    });
    
    const result = [];
    
    for (const match of matches) {
        let hasOverlap = false;

        // Check against all previously accepted matches
        for (const accepted of result) {
            // Check for any overlap
            if (match.start < accepted.end && match.end > accepted.start) {
                console.log(`🚫 Rejecting overlapping match: "${match.text}" (${match.start}-${match.end}) overlaps with "${accepted.text}" (${accepted.start}-${accepted.end})`);
                hasOverlap = true;
                break;
            }
        }
        
        if (!hasOverlap) {
            result.push(match);
            console.log(`✅ Accepted match: "${match.text}" (${match.key}, ${match.start}-${match.end})`);
        }
    }

    console.log(`📊 Final result: ${matches.length} → ${result.length} matches after overlap removal`);
    return result;
}

function highlightCitations() {
    console.log('🔍 Starting highlightCitations (TreeWalker)...');
    
    // 調試：檢查頁面文本中的法條
    const pageText = document.body.textContent || document.body.innerText || '';
    const legalRefs = pageText.match(/第[一二三四五六七八九十\d]+條/g);
    if (legalRefs) {
        console.log('🔍 頁面中發現的法條引用:', legalRefs.slice(0, 10)); // 只顯示前10個
    } else {
        console.log('🔍 頁面中沒有發現法條引用');
    }
    const seenNodes = new WeakSet();
    let created = 0;

    function processTextNode(node) {
        if (seenNodes.has(node)) return;
        if (!node.parentNode) return;
        // Skip inside our own spans or script/style/inputs
        const parentTag = node.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'INPUT') return;
        if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return;

        // Skip bookmark panel content completely, but allow side panel content with legal highlighting
        if (node.parentNode.closest && node.parentNode.closest('#citeright-bookmarks-panel')) return;

        // Skip side panel headers (blue title column) but allow content area
        const sidePanelHeader = node.parentNode.closest && node.parentNode.closest('#citeright-sidepanel > div:first-child');
        if (sidePanelHeader) return;

        // Skip any elements with blue background (title columns)
        const hasBlueBackground = node.parentNode.closest && node.parentNode.closest('[style*="background: linear-gradient(135deg, #1890ff"]');
        if (hasBlueBackground) return;

        // Allow highlighting in legal content areas of side panel
        const isInLegalContentArea = node.parentNode.closest && node.parentNode.closest('.legal-content-area');
        const isInSidepanelContent = node.parentNode.closest && node.parentNode.closest('#sidepanel-content');
        if (isInLegalContentArea || isInSidepanelContent) {
            // Continue with highlighting for legal content
        }
        const original = node.textContent;
        if (!original || !original.trim()) return;

        const normalizedText = original;

        // Find all potential matches first
        const allMatches = [];

        // IMPROVED processing order - standalone articles should be processed last to avoid conflicts
        const processingOrder = [
            'interpretation',          // 釋字第748號 - most specific, process first
            'dynamic_law_articles',    // 民法第184條第1項 - specific law + article + subsections
            'simple_law_articles',     // 民法第184條 - specific law + article only
            'law_name_only',          // 民法 - just law names
            'universal_legal_pattern', // 第184條, 第四條 - generic articles with complex structure
            'simple_article_only'      // 第四條 - simple standalone articles (fallback)
        ];

        // Debug: log which patterns are available
        console.log('🔍 Available patterns:', Object.keys(TAIWAN_LEGAL_PATTERNS).filter(k => TAIWAN_LEGAL_PATTERNS[k]));

        for (const key of processingOrder) {
            const pattern = TAIWAN_LEGAL_PATTERNS[key];
            if (!pattern) {
                console.log(`⚠️ Pattern ${key} not available`);
                continue;
            }

            let actualPattern = new RegExp(pattern.source, pattern.flags);

            let match;
            while ((match = actualPattern.exec(normalizedText)) !== null) {
                const matchText = match[0];

                // Debug: log each match found
                console.log(`🎯 Found ${key} match: "${matchText}" at position ${match.index}-${match.index + matchText.length}`);

                allMatches.push({
                    text: matchText,
                    start: match.index,
                    end: match.index + matchText.length,
                    key: key,
                    groups: Array.from(match).slice(1)
                });
                // Prevent infinite loop on global regex
                if (!actualPattern.global) break;
            }
        }

        // Debug: log all matches before filtering
        if (allMatches.length > 0) {
            console.log('🔍 Found matches before filtering:', allMatches.map(m => ({key: m.key, text: m.text, start: m.start, end: m.end})));
        }

        // Remove overlapping matches - simple version
        const filteredMatches = removeOverlappingMatches(allMatches);

        // Debug: log filtered matches
        if (filteredMatches.length > 0 && filteredMatches.length !== allMatches.length) {
            console.log('⚠️ After filtering:', filteredMatches.map(m => ({key: m.key, text: m.text, start: m.start, end: m.end})));
        }

        if (filteredMatches.length === 0) return;

        // Build HTML in a single pass to avoid corruption
        let newHTML = '';
        let lastIndex = 0;
        let changed = false;

        // Sort matches by start position (forward order)
        filteredMatches.sort((a, b) => a.start - b.start);

        for (const match of filteredMatches) {
            // Check if this match is already part of a highlighted element
            if (isAlreadyHighlighted(node, match.text)) {
                continue; // Skip this match
            }

            // Add text before this match
            newHTML += normalizedText.substring(lastIndex, match.start);

            // Add the highlighted span
            const highlighted = makeSpan(match.text, match.key, match.groups);
            newHTML += highlighted;

            // Update position
            lastIndex = match.end;
            changed = true;
        }

        // Add remaining text after last match
        if (changed) {
            newHTML += normalizedText.substring(lastIndex);
        }

        if (changed) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = newHTML;
            while (wrapper.firstChild) {
                node.parentNode.insertBefore(wrapper.firstChild, node);
            }
            node.parentNode.removeChild(node);
            created++;
        }

        seenNodes.add(node);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent || !/[字號釋憲判第度年]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
            
            // 調試：記錄包含"第四條"的節點
            if (node.textContent.includes('第四條')) {
                console.log('🔍 找到包含"第四條"的文本節點:', node.textContent.substring(0, 100) + '...');
            }
            
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const batch = [];
    while (walker.nextNode()) {
        batch.push(walker.currentNode);
        if (batch.length >= 500) {
            batch.forEach(processTextNode);
            batch.length = 0;
        }
    }
    if (batch.length) batch.forEach(processTextNode);

    const finalCount = document.querySelectorAll('.citeright-link').length;
    if (finalCount === 0) {
        console.warn('❌ 未檢測到法律引用標示。請檢查擴充套件是否已重新載入 / 或目前頁面無法律引用');
    } else {
        console.log(`✅ 法律引用偵測完成。找到 ${finalCount} 個法律引用標示 (本次新增: ${created})`);
        
        // 調試：統計各種模式的匹配次數
        const patternStats = {};
        document.querySelectorAll('.citeright-link').forEach(link => {
            const type = link.getAttribute('data-legal-type') || 'unknown';
            patternStats[type] = (patternStats[type] || 0) + 1;
        });
        console.log('📊 法條類型統計:', patternStats);
        
        // 調試：檢查頁面是否包含"第四條"
        const pageText = document.body.textContent || document.body.innerText || '';
        if (pageText.includes('第四條')) {
            console.log('🔍 頁面包含"第四條"文字，但可能沒被標記');
            // 檢查是否有被標記
            const markedFourth = Array.from(document.querySelectorAll('.citeright-link')).find(link => 
                link.textContent.includes('第四條')
            );
            if (markedFourth) {
                console.log('✅ 找到標記的第四條:', markedFourth.textContent);
            } else {
                console.log('❌ 第四條沒有被標記');
            }
        }
    }
    return finalCount;
}

// Helper function to highlight citations in a specific element
function highlightCitationsInElement(element) {
    console.log('🔍 Applying highlighting to element:', element);
    const seenNodes = new WeakSet();
    let created = 0;

    function processTextNode(node) {
        if (seenNodes.has(node)) return;
        if (!node.parentNode) return;

        // Skip inside our own spans or script/style/inputs
        const parentTag = node.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || parentTag === 'INPUT') return;
        if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return;

        // Skip bookmark panel content
        if (node.parentNode.closest && node.parentNode.closest('#citeright-bookmarks-panel')) return;

        // Skip elements with blue background (title columns)
        const hasBlueBackground = node.parentNode.closest && node.parentNode.closest('[style*="background: linear-gradient(135deg, #1890ff"]');
        if (hasBlueBackground) return;

        const original = node.textContent;
        if (!original || !original.trim()) return;

        const normalizedText = original;

        // Find all potential matches first
        const allMatches = [];

        // IMPROVED processing order - standalone articles should be processed last to avoid conflicts
        const processingOrder = [
            'interpretation',          // 釋字第748號 - most specific, process first
            'dynamic_law_articles',    // 民法第184條第1項 - specific law + article + subsections
            'simple_law_articles',     // 民法第184條 - specific law + article only
            'law_name_only',          // 民法 - just law names
            'universal_legal_pattern', // 第184條, 第四條 - generic articles with complex structure
            'simple_article_only'      // 第四條 - simple standalone articles (fallback)
        ];

        // Debug: log which patterns are available
        console.log('🔍 Available patterns:', Object.keys(TAIWAN_LEGAL_PATTERNS).filter(k => TAIWAN_LEGAL_PATTERNS[k]));

        for (const key of processingOrder) {
            const pattern = TAIWAN_LEGAL_PATTERNS[key];
            if (!pattern) {
                console.log(`⚠️ Pattern ${key} not available`);
                continue;
            }

            let actualPattern = new RegExp(pattern.source, pattern.flags);

            let match;
            while ((match = actualPattern.exec(normalizedText)) !== null) {
                const matchText = match[0];

                // Debug: log each match found
                console.log(`🎯 Found ${key} match: "${matchText}" at position ${match.index}-${match.index + matchText.length}`);

                allMatches.push({
                    text: matchText,
                    start: match.index,
                    end: match.index + matchText.length,
                    key: key,
                    groups: Array.from(match).slice(1)
                });
                // Prevent infinite loop on global regex
                if (!actualPattern.global) break;
            }
        }

        // Debug: log all matches before filtering
        if (allMatches.length > 0) {
            console.log('🔍 Found matches before filtering:', allMatches.map(m => ({key: m.key, text: m.text, start: m.start, end: m.end})));
        }

        // Remove overlapping matches - simple version
        const filteredMatches = removeOverlappingMatches(allMatches);

        // Debug: log filtered matches
        if (filteredMatches.length > 0 && filteredMatches.length !== allMatches.length) {
            console.log('⚠️ After filtering:', filteredMatches.map(m => ({key: m.key, text: m.text, start: m.start, end: m.end})));
        }

        if (filteredMatches.length === 0) return;

        // Build HTML in a single pass to avoid corruption
        let newHTML = '';
        let lastIndex = 0;
        let changed = false;

        // Sort matches by start position (forward order)
        filteredMatches.sort((a, b) => a.start - b.start);

        for (const match of filteredMatches) {
            // Check if this match is already part of a highlighted element
            if (isAlreadyHighlighted(node, match.text)) {
                continue; // Skip this match
            }

            // Add text before this match
            newHTML += normalizedText.substring(lastIndex, match.start);

            // Add the highlighted span
            const highlighted = makeSpan(match.text, match.key, match.groups);
            newHTML += highlighted;

            // Update position
            lastIndex = match.end;
            changed = true;
        }

        // Add remaining text after last match
        if (changed) {
            newHTML += normalizedText.substring(lastIndex);
        }

        if (changed) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = newHTML;
            while (wrapper.firstChild) {
                node.parentNode.insertBefore(wrapper.firstChild, node);
            }
            node.parentNode.removeChild(node);
            created++;
        }

        seenNodes.add(node);
    }


    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent || !/[字號釋憲判第度年]/.test(node.textContent)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const batch = [];
    while (walker.nextNode()) {
        batch.push(walker.currentNode);
    }
    batch.forEach(processTextNode);

    console.log(`✨ Applied highlighting to ${created} legal references in element`);
    return created;
}

// Get current session statistics
function getSessionStats() {
    const stats = {
        hoverCounts: Object.fromEntries(sessionLawCount),
        currentlyActive: activePopupLaw,
        currentlyHovered: currentHoveredLaw
    };
    console.log('📈 Session Statistics:', stats);
    return stats;
}

// Reset session data
function resetSessionData() {
    sessionLawCount.clear();
    activePopupLaw = null;
    currentHoveredLaw = null;
    popover.style.display = 'none';
    console.log('🔄 Reset session data');
}

// Expose for manual debug
if (typeof window !== 'undefined') {
    window.citerightForceHighlight = highlightCitations;
    window.citerightHighlightElement = highlightCitationsInElement;
    window.citerightSessionStats = getSessionStats;
    window.citerightResetSession = resetSessionData;
}

function createPopoverElement() {
    // Remove any existing popover
    const existing = document.getElementById('citeright-popover');
    if (existing) existing.remove();
    const popover = document.createElement('div');
    popover.id = 'citeright-popover';
    popover.style.cssText = `position:fixed;z-index:2147483650;background:#fff;border:2px solid #1890ff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.15);width:480px;max-width:95vw;font-family:"Microsoft JhengHei","Noto Sans TC",Arial,sans-serif;font-size:14px;color:#333;display:none;pointer-events:auto;backdrop-filter:blur(8px);`;
    popover.innerHTML = `
      <div class="citeright-header" style="padding:14px 18px;background:linear-gradient(135deg,#1890ff,#096dd9);color:white;border-bottom:none;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0;cursor:move;user-select:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="citeright-icon" style="font-size:18px;">⚖️</span>
          <span id="citeright-title" style="font-weight:600;font-size:16px;color:#f0f8ff;text-shadow: 1px 1px 3px rgba(0,0,0,0.5);opacity:0.95;">台灣法源資訊</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="citeright-bookmark" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="加入書籤">📚 書籤</button>
          <button class="citeright-expand" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="展開至側邊面板">📖 展開</button>
          <button class="citeright-close" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;padding:6px;cursor:pointer;font-size:16px;width:28px;height:28px;transition:all 0.2s;">&times;</button>
        </div>
      </div>
      <div class="citeright-loader" style="padding:24px;text-align:center;color:#666;background:white;">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <div style="width:16px;height:16px;border:2px solid #1890ff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          <span>正在查詢法律資料...</span>
        </div>
      </div>
      <div class="citeright-content" style="padding:18px;max-height:320px;overflow-y:auto;display:none;background:white;border-radius:0 0 10px 10px;line-height:1.6;"></div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .citeright-header button:hover { background: rgba(255,255,255,0.3) !important; transform: scale(1.05); }
        .citeright-content::-webkit-scrollbar { width: 6px; }
        .citeright-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        .citeright-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        .citeright-content::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      </style>`;
    document.body.appendChild(popover);

    // Close button event - only hides popover
    popover.querySelector('.citeright-close').addEventListener('click', e => {
        e.stopPropagation();
        popover.style.display = 'none';
        console.log('❌ 彈出視窗已關閉');
    });

    // Bookmark button event
    popover.querySelector('.citeright-bookmark').addEventListener('click', e => {
        e.stopPropagation();
        addToBookmarks();
    });

    // Expand button event - creates side panel
    popover.querySelector('.citeright-expand').addEventListener('click', e => {
        e.stopPropagation();
        console.log('🔧 Expand button clicked, currentLawData:', currentLawData);
        
        if (!currentLawData) {
            console.log('❌ No currentLawData, attempting to load from popup');
            // Try to extract data from popup if currentLawData is missing
            const title = popover.querySelector('#citeright-title').textContent;
            const content = popover.querySelector('.citeright-content').innerHTML;
            if (title && content) {
                currentLawData = {
                    id: 'popup_' + Date.now(),
                    title: title,
                    type: '法律資訊',
                    content: content,
                    fullContent: content
                };
                console.log('✅ Created currentLawData from popup content');
            }
        }
        
        openSidePanel();
        
        // Hide the popup after opening sidebar
        popover.style.display = 'none';
    });

    // Drag improvements
    let drag = { active: false, offsetX: 0, offsetY: 0 };
    const header = popover.querySelector('.citeright-header');
    header.addEventListener('mousedown', e => {
        if (e.target.classList.contains('citeright-close')) return;
        drag.active = true;
        const rect = popover.getBoundingClientRect();
        drag.offsetX = e.clientX - rect.left;
        drag.offsetY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
        if (!drag.active) return;
        let left = e.clientX - drag.offsetX;
        let top = e.clientY - drag.offsetY;
        left = Math.max(0, Math.min(left, window.innerWidth - popover.offsetWidth));
        top = Math.max(0, Math.min(top, window.innerHeight - 50));
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    });
    window.addEventListener('mouseup', () => { if (drag.active) { drag.active = false; header.style.cursor = 'move'; } });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            popover.style.display = 'none';
        }
    });
    return popover;
}

// Create popover
const popover = createPopoverElement();
let hideTimeout;
let showTimeout;              // Delay before showing popover
let currentHoveredLaw = null; // Track currently hovered law to prevent duplicates
let activePopupLaw = null;    // Track law currently shown in popup to prevent duplicates
let popupCooldown = false;    // Prevent rapid popup opening
let sessionLawCount = new Map(); // Count how many times each law has been hovered

// Enhanced state management for better UX
let isCtrlPressed = false;    // Current Ctrl key state
let isActivated = false;      // Whether hover mode is activated
let activationTimeout;        // Auto-deactivation timeout
let bookmarkedLaws = [];      // Saved bookmarks

// Helper function to update activation status
function updateActivationStatus() {
    const title = popover.querySelector('#citeright-title');
    if (title) {
        title.textContent = isActivated ? '台灣法源資訊 (滑鼠模式)' : '台灣法源資訊';
    }
}

// Helper function to generate unique law identifier
function getLawIdentifier(target) {
    const { legalType, caseType, lawName, article, paragraph, year, number } = target.dataset;
    if (legalType === 'law_article') {
        return `${lawName}第${article}條${paragraph ? `第${paragraph}項` : ''}`;
    } else if (caseType === '釋字') {
        return `釋字第${number}號`;
    } else {
        return `${year}年${caseType}字第${number}號`;
    }
}

// Enhanced Ctrl key listeners - toggles hover mode
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !isCtrlPressed) {
        isCtrlPressed = true;

        // Check if extension is globally enabled first
        if (!isExtensionEnabled) {
            showActivationNotification('擴充功能已停用', '請在工具列圖示中啟用擴充功能', '#d73527');
            return;
        }

        // Ctrl toggles hover mode
        isActivated = !isActivated;

        if (isActivated) {
            console.log('⚖️ 滑鼠懸停模式已啟用');
            showActivationNotification('滑鼠懸停模式已啟用', '移動滑鼠至法條引用查看詳情');

            // Set auto-deactivation timer (3 minutes)
            clearTimeout(activationTimeout);
            activationTimeout = setTimeout(() => {
                isActivated = false;
                popover.style.display = 'none';
                console.log('⏰ 滑鼠懸停模式已自動停用 (3分鐘無操作)');
                updateActivationStatus();
            }, 180000); // 3 minutes
        } else {
            console.log('❌ 滑鼠懸停模式已停用');
            popover.style.display = 'none';
            clearTimeout(activationTimeout);
            showActivationNotification('滑鼠懸停模式已停用', '再按 Ctrl 重新啟用', '#d73527');
        }

        updateActivationStatus();
    }
});

document.addEventListener('keyup', (e) => {
    if (!e.ctrlKey && isCtrlPressed) {
        isCtrlPressed = false;
    }
});

// Show activation notification with custom message
function showActivationNotification(title, subtitle, bgColor = '#389e0d') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2147483648;
        background: ${bgColor}; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        padding: 12px 16px; border-radius: 8px; font-family: "Microsoft JhengHei";
        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${isActivated ? '⚖️' : '❌'}</span>
            <span>${title}</span>
        </div>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            ${subtitle}
        </div>
    `;

    if (!document.getElementById('slideIn-style')) {
        const style = document.createElement('style');
        style.id = 'slideIn-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2500);
}

// Helper function to check if popover is being hovered
function isPopoverHovered() {
    return popover.matches(':hover') || popover.contains(document.querySelector(':hover'));
}

// Global variable to store current law data for bookmarking
let currentLawData = null;

// Bookmark functionality
function addToBookmarks() {
    if (!currentLawData) {
        console.log('❌ 無法加入書籤：沒有目前的法律資料');
        return;
    }

    // Check if already bookmarked
    const exists = bookmarkedLaws.find(item =>
        item.id === currentLawData.id ||
        (item.type === currentLawData.type && item.number === currentLawData.number)
    );

    if (exists) {
        showActivationNotification('已存在書籤', '此法條已經在您的書籤中', '#e67e22');
        return;
    }

    // Add to bookmarks with full content
    bookmarkedLaws.push({
        id: currentLawData.id || `${currentLawData.type}_${currentLawData.number}`,
        type: currentLawData.type,
        title: currentLawData.title,
        number: currentLawData.number,
        content: currentLawData.fullContent || currentLawData.content, // Save full content
        fullContent: currentLawData.fullContent || currentLawData.content, // Ensure fullContent is available
        officialUrl: currentLawData.officialUrl,
        lawData: currentLawData.lawData,
        articleData: currentLawData.articleData,
        dateAdded: new Date().toISOString()
    });

    // Save to localStorage
    localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));

    showActivationNotification('已加入書籤', `${currentLawData.title}`, '#52c41a');
    console.log('📚 已加入書籤:', currentLawData.title);
}

// Create main sidebar with fixed background + floating tool panel
function createMainSidebar() {
    // Remove any existing sidebar
    const existingSidebar = document.getElementById('citeright-sidebar-background');
    if (existingSidebar) {
        existingSidebar.remove();
    }
    
    const existingToolPanel = document.getElementById('citeright-tool-panel');
    if (existingToolPanel) {
        existingToolPanel.remove();
    }

    // 1. Create FIXED sidebar background (only show when needed)
    const sidebarBackground = document.createElement('div');
    sidebarBackground.id = 'citeright-sidebar-background';
    sidebarBackground.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 33vw;
        height: 100vh;
        background: rgba(24, 144, 255, 0.03);
        z-index: 2147483645;
        border-left: 1px solid rgba(24, 144, 255, 0.1);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    document.body.appendChild(sidebarBackground);
    
    // 2. Create DRAGGABLE blue tool panel (floats inside sidebar)
    const savedPanelWidth = localStorage.getItem('citeright-panel-width');
    const sidebarWidth = Math.floor(window.innerWidth / 3);
    const defaultPanelWidth = sidebarWidth - 10; // Slightly smaller than sidebar
    const panelWidth = savedPanelWidth ? parseInt(savedPanelWidth) : defaultPanelWidth;
    
    const toolPanel = document.createElement('div');
    toolPanel.id = 'citeright-tool-panel';
    toolPanel.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: ${panelWidth}px;
        height: 100vh;
        background: white;
        border-left: 3px solid #1890ff;
        z-index: 2147483647;
        font-family: "Microsoft JhengHei", Arial, sans-serif;
        font-size: 14px;
        box-shadow: -6px 0 18px rgba(0,0,0,0.15);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    toolPanel.innerHTML = `
        <div id="resize-handle" style="position: absolute; left: -6px; top: 0; bottom: 0; width: 12px; background: linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff); cursor: ew-resize; z-index: 10; opacity: 0.8; transition: all 0.2s; border-radius: 4px 0 0 4px; box-shadow: -2px 0 8px rgba(24,144,255,0.3);"></div>
        
        <!-- Tab Navigation -->
        <div style="background: linear-gradient(135deg, #1890ff, #096dd9); color: white; padding: 16px; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 600;">CiteRight 工具面板</h2>
                <button id="close-tool-panel" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 8px; cursor: pointer; font-size: 18px; width: 36px; height: 36px;">&times;</button>
            </div>
            
            <div class="tab-navigation" style="display: flex; gap: 8px;">
                <button id="tab-tool" class="tab-btn active" data-tab="tool">
                    🔧 法律工具
                </button>
                <button id="tab-bookmarks" class="tab-btn" data-tab="bookmarks">
                    📚 我的書籤
                </button>
            </div>
        </div>
        
        <!-- Tab Content Areas -->
        <div id="tab-content-tool" class="tab-content active">
            <div class="tab-content-inner">
                <div id="tool-content">
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🔧</div>
                        <div>請點擊法律條文來查看詳細資訊</div>
                        <div style="font-size: 12px; margin-top: 8px;">按 Ctrl 啟動懸停模式</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="tab-content-bookmarks" class="tab-content">
            <div class="tab-content-inner">
                <div id="bookmarks-content">
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                        <div>正在載入書籤...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(toolPanel);

    // Adjust web content for fixed sidebar background (only once)
    adjustWebContentForSidebar(Math.floor(window.innerWidth / 3));

    // Show tool panel with animation
    setTimeout(() => {
        toolPanel.style.transform = 'translateX(0)';
    }, 10);

    setupToolPanelEventListeners(toolPanel);
    loadBookmarksContent();
    
    return toolPanel;
}

// Simple overlay for reference (not used in new layout)
function createWebContentOverlay() {
    // No longer needed - using simple body width adjustment
    console.log('🗑️ Overlay not needed for simple split layout');
}

// Simple 2-page split layout 
function adjustWebContentForSidebar(sidebarWidth) {
    console.log('🔧 Simple 2-page split layout, sidebar width:', sidebarWidth);
    
    if (sidebarWidth > 0) {
        // Simple approach: just make body narrower
        document.body.style.width = `calc(100vw - ${sidebarWidth}px)`;
        document.body.style.maxWidth = `calc(100vw - ${sidebarWidth}px)`;
        document.body.style.transition = 'width 0.3s ease';
        document.body.style.overflow = 'auto';
        
        console.log('✅ Page split: Left content, right sidebar');
    } else {
        // Restore full width
        document.body.style.width = '';
        document.body.style.maxWidth = '';
        document.body.style.transition = '';
        
        console.log('✅ Restored full page');
    }
}

// Setup event listeners for tool panel
function setupToolPanelEventListeners(toolPanel) {
    // Tab switching
    const tabButtons = toolPanel.querySelectorAll('.tab-btn');
    const tabContents = toolPanel.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update button states
            tabButtons.forEach(b => {
                if (b.dataset.tab === targetTab) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            // Update content visibility
            tabContents.forEach(content => {
                if (content.id === `tab-content-${targetTab}`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
            
            // Load content if switching to bookmarks
            if (targetTab === 'bookmarks') {
                loadBookmarksContent();
            }
        });
    });

    // Close button
    toolPanel.querySelector('#close-tool-panel').addEventListener('click', () => {
        closeToolPanel();
    });

    // Resize functionality
    setupToolPanelResize(toolPanel);
}

// Setup tool panel resize functionality (ONLY resize width, panel stays on right)
function setupToolPanelResize(toolPanel) {
    const resizeHandle = toolPanel.querySelector('#resize-handle');
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    const sidebarBoundary = Math.floor(window.innerWidth / 3);

    resizeHandle.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
        resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.8), #1890ff)';
    });

    resizeHandle.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0.8';
            resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff)';
        }
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(toolPanel).width, 10);
        
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        
        console.log('🔧 Started resizing panel width');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = startX - e.clientX; // Reverse for expanding leftward
        let newWidth = startWidth + deltaX;

        // Apply constraints - minimum matches sidebar width exactly, maximum is 80% of screen
        const minWidth = Math.floor(sidebarBoundary); // Can be as small as sidebar space
        const maxWidth = window.innerWidth * 0.8;
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        toolPanel.style.width = newWidth + 'px';
        
        // Get sidebar background element
        const sidebarBackground = document.getElementById('citeright-sidebar-background');
        
        // If panel width exceeds sidebar area, make it float over content and show background
        if (newWidth > sidebarBoundary) {
            toolPanel.style.zIndex = '2147483648'; // Float over content
            toolPanel.style.boxShadow = '-8px 0 24px rgba(0,0,0,0.25)';
            if (sidebarBackground) sidebarBackground.style.opacity = '1'; // Show background
            console.log('🌊 Panel floating over content');
        } else {
            toolPanel.style.zIndex = '2147483647'; // Stay in sidebar area
            toolPanel.style.boxShadow = '-6px 0 18px rgba(0,0,0,0.15)';
            if (sidebarBackground) sidebarBackground.style.opacity = '0'; // Hide background
            console.log('📍 Panel within sidebar area');
        }
        
        console.log('🔄 Resizing panel width:', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            const finalWidth = parseInt(toolPanel.style.width);
            
            // Save width to localStorage
            localStorage.setItem('citeright-panel-width', finalWidth);
            console.log('💾 Saved panel width to localStorage:', finalWidth + 'px');
            
            // Reset handle visual state
            resizeHandle.style.opacity = '0.8';
            resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff)';
            
            console.log('✅ Finished resizing panel');
        }
    });
}

// Close tool panel (keeps sidebar background)
function closeToolPanel() {
    const toolPanel = document.getElementById('citeright-tool-panel');
    if (toolPanel) {
        toolPanel.style.transform = 'translateX(100%)';
        setTimeout(() => toolPanel.remove(), 300);
    }
    
    // Remove sidebar background too
    const sidebarBackground = document.getElementById('citeright-sidebar-background');
    if (sidebarBackground) {
        sidebarBackground.remove();
    }
    
    // Restore web content
    adjustWebContentForSidebar(0);
    
    console.log('✅ Tool panel closed');
}

// Setup sidebar resize functionality with floating behavior (OLD - keeping for reference)
function setupSidebarResize(sidebar) {
    const resizeHandle = sidebar.querySelector('#resize-handle');
    let isResizing = false;
    let startX = 0;
    let startWidth = 300;
    let isFloating = false;

    resizeHandle.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = '1';
        resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.8), #1890ff)';
    });

    resizeHandle.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0.8';
            resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff)';
        }
    });

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        
        console.log('🔧 Starting resize - switching to floating mode');
        
        // Switch to floating mode when dragging starts
        isFloating = true;
        sidebar.style.zIndex = '2147483648'; // Higher z-index when floating
        sidebar.style.boxShadow = '-8px 0 32px rgba(0,0,0,0.25)'; // Stronger shadow
        
        // Restore web content to full width immediately
        document.body.style.width = '100vw';
        document.body.style.maxWidth = '100vw';
        document.body.style.transition = 'width 0.2s ease';
        
        console.log('✅ Switched to floating mode - web content restored to full width');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = startX - e.clientX; // Reverse for right-side panel
        let newWidth = startWidth + deltaX;

        // Apply constraints
        newWidth = Math.max(250, Math.min(newWidth, window.innerWidth * 0.7));

        sidebar.style.width = newWidth + 'px';
        
        // Don't adjust web content while dragging - sidebar floats over content
        console.log('🔄 Resizing in floating mode:', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizeHandle.style.opacity = '0.8';
            resizeHandle.style.background = 'linear-gradient(90deg, rgba(24,144,255,0.5), #1890ff)';
            
            const finalWidth = parseInt(sidebar.style.width);
            
            // Save the width to localStorage
            localStorage.setItem('citeright-sidebar-width', finalWidth);
            console.log('💾 Saved sidebar width to localStorage:', finalWidth + 'px');
            
            // After dragging ends, switch back to 2-page layout
            setTimeout(() => {
                isFloating = false;
                sidebar.style.zIndex = '2147483647'; // Normal z-index
                sidebar.style.boxShadow = '-6px 0 18px rgba(0,0,0,0.12)'; // Normal shadow
                
                // Re-apply 2-page layout with new width
                adjustWebContentForSidebar(finalWidth);
                
                console.log('✅ Switched back to 2-page layout with new width:', finalWidth + 'px');
            }, 100);
        }
    });
}

// Close sidebar and restore web content
function closeSidebar() {
    const sidebar = document.getElementById('citeright-main-sidebar');
    if (sidebar) {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => sidebar.remove(), 300);
        adjustWebContentForSidebar(0);
    }
    
    const overlay = document.getElementById('citeright-web-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Load bookmarks content
function loadBookmarksContent() {
    const savedBookmarks = localStorage.getItem('citeright_bookmarks');
    if (savedBookmarks) {
        bookmarkedLaws = JSON.parse(savedBookmarks);
    }

    const bookmarksContent = document.getElementById('bookmarks-content');
    if (!bookmarksContent) return;

    if (bookmarkedLaws.length === 0) {
        bookmarksContent.innerHTML = `
            <div style="text-align: center; color: #999; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                <div>尚未儲存任何書籤</div>
                <div style="font-size: 12px; margin-top: 8px;">在法條詳情中點擊「加入書籤」來儲存</div>
            </div>
        `;
        return;
    }

    bookmarksContent.innerHTML = `
        <div style="margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; color: #1890ff;">我的法律書籤 (${bookmarkedLaws.length})</h3>
        </div>
        ${bookmarkedLaws.map((bookmark, index) => `
            <div class="bookmark-item" data-bookmark-id="${bookmark.id}" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e8e8e8; cursor: pointer; transition: all 0.2s;">
                <div style="font-weight: 600; color: #1890ff; margin-bottom: 8px;">${bookmark.title}</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    ${bookmark.type} · 儲存於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}
                </div>
                <div style="font-size: 13px, color: #555; line-height: 1.5;">
                    ${bookmark.content ? bookmark.content.substring(0, 100) + (bookmark.content.length > 100 ? '...' : '') : '無內容摘要'}
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="view-bookmark" style="padding: 4px 8px; font-size: 11px; background: #f0f9ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 4px; cursor: pointer;">查看</button>
                    <button class="delete-bookmark" style="padding: 4px 8px; font-size: 11px; background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; border-radius: 4px; cursor: pointer;">刪除</button>
                </div>
            </div>
        `).join('')}
    `;

    // Setup bookmark interactions
    bookmarksContent.querySelectorAll('.view-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            const bookmark = bookmarkedLaws.find(b => b.id === bookmarkId);
            if (bookmark) {
                loadBookmarkInToolTab(bookmark);
            }
        });
    });

    bookmarksContent.querySelectorAll('.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
            localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
            loadBookmarksContent(); // Refresh the list
        });
    });
}

// Load bookmark content in tool tab
function loadBookmarkInToolTab(bookmark) {
    // Switch to tool tab
    const toolTabBtn = document.getElementById('tab-tool');
    const bookmarkTabBtn = document.getElementById('tab-bookmarks');
    const toolContent = document.getElementById('tab-content-tool');
    const bookmarkContent = document.getElementById('tab-content-bookmarks');
    
    if (toolTabBtn && bookmarkTabBtn && toolContent && bookmarkContent) {
        // Update tab buttons
        toolTabBtn.classList.add('active');
        bookmarkTabBtn.classList.remove('active');
        
        // Update content visibility
        toolContent.classList.add('active');
        bookmarkContent.classList.remove('active');
    }
    
    // Load content into tool tab
    const toolContentDiv = document.getElementById('tool-content');
    if (toolContentDiv && bookmark) {
        console.log('📝 Loading content for bookmark:', bookmark.title);
        
        // Update currentLawData
        currentLawData = {
            ...bookmark,
            content: bookmark.fullContent || bookmark.content,
            fullContent: bookmark.fullContent || bookmark.content
        };
        
        // Clean and prepare content
        const displayContent = bookmark.fullContent || bookmark.content || '無內容可顯示';
        const cleanContent = displayContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
        
        toolContentDiv.innerHTML = `
            <div style="margin-bottom: 16px; padding: 16px; background: linear-gradient(135deg, #f0f9ff, #e6f7ff); border-radius: 8px; border-left: 4px solid #1890ff;">
                <h3 style="margin: 0 0 8px 0; color: #1890ff; font-size: 18px;">${bookmark.title}</h3>
                <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                    📝 ${bookmark.type} ${bookmark.number ? `· 第${bookmark.number}${bookmark.type === '釋字' ? '號' : '條'}` : ''} · ${bookmark.dateAdded ? new Date(bookmark.dateAdded).toLocaleDateString('zh-TW') : '未知日期'}
                </div>
            </div>
            
            <div id="tool-main-content" class="legal-content-area" style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e8e8e8; color: #333; line-height: 1.8; font-size: 15px; min-height: 200px;">
                ${cleanContent}
            </div>
            
            <div style="margin-top: 20px; padding: 12px; background: #fafafa; border-radius: 6px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="add-to-bookmarks" style="padding: 6px 10px; border: 1px solid #52c41a; background: #f6ffed; color: #52c41a; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;">📚 加入書籤</button>
                    <button id="remove-from-bookmarks" style="padding: 6px 10px; border: 1px solid #ff4d4f; background: #fff2f0; color: #ff4d4f; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;">🗑️ 移除書籤</button>
                    ${bookmark.officialUrl ? `<button id="official-link" style="padding: 6px 10px; border: 1px solid #1890ff; background: #f0f9ff; color: #1890ff; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;">🔗 官方頁面</button>` : ''}
                </div>
            </div>
        `;
        
        console.log('✅ Content loaded successfully in tool tab');
        
        // Setup action buttons
        const addBtn = toolContentDiv.querySelector('#add-to-bookmarks');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                if (currentLawData) {
                    addToBookmarks();
                    console.log('✅ Added to bookmarks via sidebar');
                }
            });
        }

        const removeBtn = toolContentDiv.querySelector('#remove-from-bookmarks');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                // Remove from bookmarks
                bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmark.id);
                localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
                loadBookmarksContent(); // Refresh bookmark list
                
                // Show placeholder in tool content
                toolContentDiv.innerHTML = `
                    <div style="text-align: center; color: #999; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                        <div>書籤已移除</div>
                        <div style="font-size: 12px; margin-top: 8px;">請點擊法律條文來查看詳細資訊</div>
                    </div>
                `;
                console.log('✅ Removed from bookmarks via sidebar');
            });
        }

        const officialLink = toolContentDiv.querySelector('#official-link');
        if (officialLink && bookmark.officialUrl) {
            officialLink.addEventListener('click', () => {
                window.open(bookmark.officialUrl, '_blank');
            });
        }
        
        // Apply highlighting to the new content
        setTimeout(() => {
            const contentDiv = toolContentDiv.querySelector('#tool-main-content');
            if (contentDiv) {
                highlightCitationsInElement(contentDiv);
            }
        }, 100);
    }
}

// Side panel functionality (modified to use main sidebar)
function openSidePanel() {
    console.log('🔧 Opening side panel with data:', currentLawData);
    
    if (!currentLawData) {
        console.log('❌ 無法展開側邊面板：沒有目前的法律資料');
        alert('❌ 無法展開側邊面板：沒有目前的法律資料。請先點擊法律條文。');
        return;
    }

    // Remove any existing sidebar first
    const existingSidebar = document.getElementById('citeright-main-sidebar');
    if (existingSidebar) {
        existingSidebar.remove();
    }

    // Create fresh sidebar
    const sidebar = createMainSidebar();
    console.log('✅ Sidebar created');
    
    // Ensure the sidebar is shown with animation
    setTimeout(() => {
        sidebar.classList.add('open');
        sidebar.style.transform = 'translateX(0)';
        console.log('✅ Sidebar animation triggered');
    }, 50);
    
    // Switch to tool tab and load content after a short delay
    setTimeout(() => {
        loadBookmarkInToolTab(currentLawData);
        console.log('✅ Content loaded in tool tab');
    }, 200);
}

// Show bookmarks panel
function showBookmarksPanel() {
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem('citeright_bookmarks');
    if (savedBookmarks) {
        bookmarkedLaws = JSON.parse(savedBookmarks);
    }

    // Calculate side panel width for proper positioning
    const sidePanel = document.querySelector('#citeright-sidepanel');
    const sidePanelWidth = sidePanel ? parseInt(window.getComputedStyle(sidePanel).width, 10) : 450;

    const bookmarksPanel = document.createElement('div');
    bookmarksPanel.id = 'citeright-bookmarks-panel';
    bookmarksPanel.style.cssText = `
        position: fixed; top: 0; right: ${sidePanelWidth}px; width: 400px; height: 100vh;
        background: #f8f9fa; border-left: 2px solid #e8e8e8; z-index: 2147483646;
        font-family: "Microsoft JhengHei"; overflow-y: auto; transform: translateX(100%);
        transition: transform 0.3s ease-out;
    `;

    bookmarksPanel.innerHTML = `
        <div style="background: #1890ff; color: white; padding: 20px; position: sticky; top: 0;">
            <div style="display: flex; justify-content: between; align-items: center;">
                <h2 style="margin: 0; font-size: 18px;">📚 我的法律書籤</h2>
                <button id="close-bookmarks" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; padding: 6px; cursor: pointer; font-size: 16px; width: 28px; height: 28px; margin-left: auto;">&times;</button>
            </div>
            <div style="font-size: 13px; opacity: 0.9; margin-top: 8px;">
                已儲存 ${bookmarkedLaws.length} 個書籤
            </div>
        </div>
        
        <div style="padding: 20px;">
            ${bookmarkedLaws.length === 0 ? `
                <div style="text-align: center; color: #999; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                    <div>尚未儲存任何書籤</div>
                    <div style="font-size: 12px; margin-top: 8px;">在法條詳情中點擊「加入書籤」來儲存</div>
                </div>
            ` : bookmarkedLaws.map((bookmark, index) => `
                <div class="bookmark-item" data-bookmark-id="${bookmark.id}" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e8e8e8; cursor: pointer; transition: all 0.2s;">
                    <div style="font-weight: 600; color: #1890ff; margin-bottom: 8px;">${bookmark.title}</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        ${bookmark.type} · 儲存於 ${new Date(bookmark.dateAdded).toLocaleDateString('zh-TW')}
                    </div>
                    <div style="font-size: 13px; color: #555; line-height: 1.5;">
                        ${bookmark.content ? bookmark.content.substring(0, 100) + '...' : '無內容摘要'}
                    </div>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button class="view-bookmark" style="padding: 4px 8px; font-size: 11px; background: #f0f9ff; color: #1890ff; border: 1px solid #91d5ff; border-radius: 4px; cursor: pointer;">查看</button>
                        <button class="delete-bookmark" style="padding: 4px 8px; font-size: 11px; background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; border-radius: 4px; cursor: pointer;">刪除</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(bookmarksPanel);

    // Show with animation
    setTimeout(() => {
        bookmarksPanel.style.transform = 'translateX(0)';
    }, 10);

    // Event listeners
    bookmarksPanel.querySelector('#close-bookmarks').addEventListener('click', () => {
        bookmarksPanel.style.transform = 'translateX(100%)';
        setTimeout(() => bookmarksPanel.remove(), 300);
    });

    // Bookmark item interactions
    bookmarksPanel.querySelectorAll('.view-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            const bookmark = bookmarkedLaws.find(b => b.id === bookmarkId);
            if (bookmark) {
                // Ensure we have full content for bookmarks
                currentLawData = {
                    ...bookmark,
                    content: bookmark.fullContent || bookmark.content,
                    fullContent: bookmark.fullContent || bookmark.content
                };
                openSidePanel();
            }
        });
    });

    bookmarksPanel.querySelectorAll('.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bookmarkId = e.target.closest('.bookmark-item').dataset.bookmarkId;
            bookmarkedLaws = bookmarkedLaws.filter(b => b.id !== bookmarkId);
            localStorage.setItem('citeright_bookmarks', JSON.stringify(bookmarkedLaws));
            e.target.closest('.bookmark-item').remove();

            // Update counter
            const counter = bookmarksPanel.querySelector('div[style*="opacity: 0.9"]');
            if (counter) {
                counter.textContent = `已儲存 ${bookmarkedLaws.length} 個書籤`;
            }
        });
    });
}

// Helper function to split citations connected by "及" into separate entities
function splitConnectedCitations(text) {
    const splits = [];

    // Pattern to match complex legal citations that might be connected by "及"
    // This matches patterns like "第十一條第一項第二款及第三款" or "第5條第2項及第6條第1項"
    const connectedPattern = /(第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+(?:\s*條之\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+)?\s*條(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*項)?(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*[款目])?)及(第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+(?:\s*[項款目]|(?:\s*條(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*項)?(?:第\s*[0-9０-９一二三四五六七八九十百千萬億兆零壹貳參肆伍陸柒捌玖拾佰仟萬憶]+\s*[款目])?)))/g;

    let lastIndex = 0;
    let match;

    while ((match = connectedPattern.exec(text)) !== null) {
        // Add text before this match
        if (match.index > lastIndex) {
            splits.push({
                text: text.substring(lastIndex, match.index),
                originalStart: lastIndex,
                isSplit: false
            });
        }

        // Split the matched citation into parts
        const fullMatch = match[0];
        const firstPart = match[1];  // Everything before "及"
        const secondPart = match[2]; // Everything after "及"

        const matchStart = match.index;
        const conjunctionIndex = fullMatch.indexOf('及');

        // Add first part
        splits.push({
            text: firstPart,
            originalStart: matchStart,
            isSplit: true
        });

        // Add second part (with proper positioning)
        splits.push({
            text: secondPart,
            originalStart: matchStart + conjunctionIndex + 1, // +1 for the "及" character
            isSplit: true
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        splits.push({
            text: text.substring(lastIndex),
            originalStart: lastIndex,
            isSplit: false
        });
    }

    // If no splits were found, return original text as single piece
    if (splits.length === 0) {
        return [{
            text: text,
            originalStart: 0,
            isSplit: false
        }];
    }

    return splits;
}


// MutationObserver to handle dynamically loaded content
(function setupObserver(){
    let highlightTimeout;
    let isHighlighting = false;

    function safeHighlight(){
        // Prevent re-entrance during highlighting
        if (isHighlighting) {
            console.log('🚫 Already highlighting, skipping...');
            return;
        }

        // Clear any pending timeout
        clearTimeout(highlightTimeout);

        // Debounce to prevent rapid successive calls
        highlightTimeout = setTimeout(() => {
            try {
                isHighlighting = true;
                console.log('🔄 Starting debounced highlight...');
                highlightCitations();
            } catch (e) {
                console.error('Highlight error', e);
            } finally {
                isHighlighting = false;
            }
        }, 150); // 150ms debounce
    }

    if (!document.body) {
        return document.addEventListener('DOMContentLoaded', safeHighlight);
    }

    const observer = new MutationObserver(mutations => {
        // Skip mutations caused by our own highlighting
        let shouldProcess = false;

        for (const m of mutations) {
            if (m.type === 'childList') {
                for (const node of m.addedNodes) {
                    // Skip if this is one of our highlight spans
                    if (node.nodeType === 1 && node.classList && node.classList.contains('citeright-link')) {
                        continue;
                    }
                    // Skip if this is inside our highlight spans
                    if (node.nodeType === 1 && node.closest && node.closest('.citeright-link')) {
                        continue;
                    }
                    // Process if it's text or contains text
                    if (node.nodeType === Node.TEXT_NODE ||
                        (node.nodeType === 1 && node.innerText && !node.classList.contains('citeright-link'))) {
                        shouldProcess = true;
                        break;
                    }
                }
                if (shouldProcess) break;
            } else if (m.type === 'characterData') {
                // Skip if the text change is in our highlight spans
                if (m.target.parentNode && m.target.parentNode.closest &&
                    m.target.parentNode.closest('.citeright-link')) {
                    continue;
                }
                shouldProcess = true;
                break;
            }
        }

        if (shouldProcess) {
            console.log('🔍 DOM changed, scheduling highlight...');
            safeHighlight();
        }
    });

    try {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        console.log('🔁 MutationObserver active with debouncing');
    } catch (e) {
        console.warn('Observer failed to start', e.message);
    }
})();

// Initialize extension (modified logging)
function initializeExtension() {
    console.log('🔍 法源探測器 (CiteRight) 啟動 - 正在掃描頁面案號');
    // Add CSS (ensure not duplicated)
    if (!document.getElementById('citeright-style')) {
        const style = document.createElement('style');
        style.id = 'citeright-style';
        style.textContent = `
        .citeright-link { 
            background: linear-gradient(120deg, #e6f7ff 0%, #f0f9ff 100%) !important; 
            border-bottom: 2px dotted #1890ff !important; 
            cursor: pointer !important; 
            transition: all .3s ease !important; 
            padding: 2px 4px !important; 
            border-radius: 4px !important; 
            position: relative !important; 
            font-weight: 500 !important;
            box-shadow: 0 1px 3px rgba(24,144,255,0.1) !important;
        }
        .citeright-link:hover { 
            background: linear-gradient(120deg, #bae7ff 0%, #e6f7ff 100%) !important; 
            border-bottom: 2px solid #1890ff !important; 
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 8px rgba(24,144,255,0.2) !important;
        }
        .citeright-link[data-legal-type="law_article"] { 
            border-bottom-color: #52c41a !important; 
            background: linear-gradient(120deg, #f6ffed 0%, #f0f9ff 100%) !important; 
        }
        .citeright-link[data-legal-type="interpretation"] { 
            border-bottom-color: #722ed1 !important; 
            background: linear-gradient(120deg, #f9f0ff 0%, #f0f9ff 100%) !important; 
        }
        .citeright-link:hover::after { 
            content: attr(title) !important; 
            position: absolute !important; 
            bottom: 100% !important; 
            left: 50% !important; 
            transform: translateX(-50%) !important; 
            background: rgba(0,0,0,0.8) !important; 
            color: white !important; 
            padding: 6px 10px !important; 
            border-radius: 6px !important; 
            font-size: 12px !important; 
            white-space: nowrap !important; 
            z-index: 10000 !important; 
            pointer-events: none !important;
            font-weight: normal !important;
            backdrop-filter: blur(4px) !important;
        }
        .citeright-link:hover::before { 
            content: "" !important; 
            position: absolute !important; 
            bottom: 100% !important; 
            left: 50% !important; 
            transform: translateX(-50%) translateY(100%) !important; 
            border: 5px solid transparent !important; 
            border-top-color: rgba(0,0,0,0.8) !important; 
            z-index: 10000 !important; 
            pointer-events: none !important; 
        }
        `;
        document.head.appendChild(style);
    }
    setTimeout(() => {
        const count = highlightCitations();
        if (count === 0) {
            // Provide sample test output
            const testText = '在110年度台上字第3214號判決中，以及釋字第748號與109年憲判字第13號';
            Object.entries(TAIWAN_LEGAL_PATTERNS).forEach(([k,p]) => {
                let actualPattern;
                
                if (k === 'law_article') {
                    if (!dynamicLegalArticleRegex) return;
                    actualPattern = dynamicLegalArticleRegex;
                } else if (p === null) {
                    return;
                } else {
                    actualPattern = new RegExp(p.source, p.flags);
                }
                
                const m = testText.match(actualPattern);
                console.log('Pattern test', k, m);
            });
        }
    }, 300);
}

// Listen for messages from background script and popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "activateCiteRight") {
            isActivated = true;
            console.log('⚖️ 透過右鍵選單啟用台灣法源探測器');
            showActivationNotification();
            updateActivationStatus();

            // If there's selected text, try to highlight it immediately
            if (message.selectedText) {
                console.log('📝 選取文字:', message.selectedText);
                highlightCitations();
            }

            // Set auto-deactivation timer
            clearTimeout(activationTimeout);
            activationTimeout = setTimeout(() => {
                isActivated = false;
                popover.style.display = 'none';
                console.log('⏰ 法源探測器已自動停用 (5分鐘無操作)');
                updateActivationStatus();
            }, 300000);

            sendResponse({ success: true });
        } else if (message.action === "deactivateCiteRight") {
            isActivated = false;
            popover.style.display = 'none';
            clearTimeout(activationTimeout);
            console.log('❌ 透過右鍵選單停用台灣法源探測器');
            updateActivationStatus();
            sendResponse({ success: true });
        } else if (message.action === "toggleExtension") {
            isExtensionEnabled = message.enabled;

            if (isExtensionEnabled) {
                console.log('🟢 CiteRight 擴充功能已透过彈出視窗啟用');
                showActivationNotification('擴充功能已啟用', '按 Ctrl 啟動懸停模式', '#52c41a');
            } else {
                console.log('🔴 CiteRight 擴充功能已透过彈出視窗停用');
                isActivated = false;
                popover.style.display = 'none';
                clearTimeout(activationTimeout);
                showActivationNotification('擴充功能已停用', '所有功能已關閉', '#d73527');
            }
            updateActivationStatus();
            sendResponse({ success: true });
        } else if (message.action === "openBookmarks") {
            console.log('📚 透過彈出視窗開啟書籤面板');
            showBookmarksPanel();
            sendResponse({ success: true });
        } else if (message.action === "getStatus") {
            sendResponse({
                activated: isActivated,
                bookmarkCount: bookmarkedLaws.length
            });
        }
    });
}

// Global extension enabled state (separate from activation) - default enabled
let isExtensionEnabled = true;

// Apply enabled state from background broadcast at startup
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['citeright_enabled'], res => {
        // Default to enabled if not set
        isExtensionEnabled = res.citeright_enabled !== undefined ? res.citeright_enabled : true;
        if (isExtensionEnabled) {
            console.log('🟢 CiteRight 擴充功能已啟用');
        } else {
            console.log('🔴 CiteRight 擴充功能已停用');
        }
        updateActivationStatus();
    });
}

// Initialize extension when content script loads
initializeExtension();

// Extend existing message handler for global enable broadcast
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'setEnabledState') {
            isExtensionEnabled = !!msg.enabled;
            if (!isExtensionEnabled) {
                isActivated = false;
                popover.style.display = 'none';
                clearTimeout(activationTimeout);
                showActivationNotification('擴充功能已停用', '所有功能已關閉', '#d73527');
            } else {
                showActivationNotification('擴充功能已啟用', '按 Ctrl 啟動懸停模式', '#52c41a');
            }
            updateActivationStatus();
        }
    });
}
