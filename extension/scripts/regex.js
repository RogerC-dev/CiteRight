/**
 * 動態產生法條搜尋的正規表示式
 * @param {Array<string>} legalNames - 法律名稱陣列（從JSON檔案載入）
 * @param {Object} options - 選項設定
 * @returns {RegExp} 正規表示式物件
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
    const articleNumberPattern = '[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\\s*條之\\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)?';
    
    // 建立項、款、目模式（可選）- 整個項款目作為一個捕獲群組
    const subsectionPattern = supportSubsections ? 
        '(?:第\\s*([0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+(?:\\s*項第\\s*[0-9０-９一二三四五六七八九十百千萬零壹貳參肆伍陸柒捌玖拾佰仟萬]+)*)\\s*[項款目])?' : '';

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
 * 從JSON檔案載入法律名稱
 * @param {string} jsonData - JSON字符串或JSON物件
 * @returns {Array<string>} 法律名稱陣列
 */
function loadLegalNamesFromJson(jsonData) {
    let data;

    if (typeof jsonData === 'string') {
        data = JSON.parse(jsonData);
    } else {
        data = jsonData;
    }

    // 假設JSON結構可能是：
    // 1. 直接陣列: ["民法", "刑法", ...]
    // 2. 物件with陣列: {laws: ["民法", "刑法", ...]}
    // 3. 物件陣列: [{name: "民法"}, {name: "刑法"}, ...]

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

/**
 * 搜尋文本中的法條
 * @param {string} text - 要搜尋的文本
 * @param {RegExp} regex - 正規表示式
 * @returns {Array<Object>} 匹配結果
 */
function findLegalArticles(text, regex) {
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            fullMatch: match[0],
            legalName: match[1] || null,
            articleNumber: match[2] || null,
            index: match.index,
            length: match[0].length
        });
    }

    return matches;
}

// 使用範例
const exampleJson = {
    "laws": [
        "民法",
        "刑法",
        "商事法",
        "行政程序法",
        "民事訴訟法",
        "刑事訴訟法",
        "憲法",
        "勞動基準法",
        "公司法",
        "證券交易法"
    ]
};

// 載入法律名稱
const legalNames = loadLegalNamesFromJson(exampleJson);
console.log('載入的法律名稱:', legalNames);

// 產生正規表示式
const regex = generateLegalArticleRegex(legalNames, {
    caseSensitive: false,
    matchWholeWord: true,
    captureGroups: true,
    allowSpaces: true
});

console.log('產生的正規表示式:', regex);

// 測試文本
const testText = `
根據民法第184條規定，故意或過失不法侵害他人之權利者，負損害賠償責任。
另外刑法第271條殺人罪也有相關規定。
參考行政程序法第 43 條和公司法第123-1條。
`;

// 搜尋法條
const results = findLegalArticles(testText, regex);
console.log('搜尋結果:', results);

// 簡化版本：只生成正規表示式字串
function generateSimpleRegexString(legalNames) {
    const escapedNames = legalNames.map(name =>
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');

    return `(${escapedNames})第(\\d+(?:\\.\\d+)?(?:-\\d+(?:\\.\\d+)?)?)條`;
}

console.log('簡化版正規表示式字串:', generateSimpleRegexString(legalNames));

// 導出函數供其他模組使用
export { generateLegalArticleRegex, loadLegalNamesFromJson, findLegalArticles };