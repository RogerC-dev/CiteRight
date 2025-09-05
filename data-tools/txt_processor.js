// txt_processor.js - 司法院TXT數據處理器
// 專門處理司法院終結案件TXT格式文件並導入API服務器

const fs = require('fs');
const path = require('path');

class JudicialTxtProcessor {
    constructor() {
        this.extractedPath = './extracted_data';
        this.outputPath = './judicial_cases_database.json';
        this.logPath = './txt_import_log.txt';

        this.stats = {
            totalFiles: 0,
            processedFiles: 0,
            totalCases: 0,
            successfulImports: 0,
            failedImports: 0,
            duplicates: 0,
            startTime: Date.now()
        };

        this.cases = new Map(); // 使用Map避免重複
        this.seenCaseIds = new Set();
        this.errorLog = [];
        this.courtMapping = new Map(); // 法院代碼對應
        this.caseTypeMapping = new Map(); // 案件類型對應
    }

    // 主執行函數
    async run() {
        console.log('🏛️  司法院TXT數據處理器啟動');
        this.log('🚀 TXT處理開始');

        try {
            // 1. 建立法院和案件類型映射
            this.buildMappings();

            // 2. 掃描所有TXT文件
            const txtFiles = await this.scanTxtFiles();
            console.log(`📄 發現 ${txtFiles.length} 個TXT文件`);

            // 3. 處理每個TXT文件
            await this.processTxtFiles(txtFiles);

            // 4. 生成最終數據庫
            await this.generateDatabase();

            // 5. 生成統計報告
            this.generateReport();

            console.log('✅ TXT處理完成！');

        } catch (error) {
            console.error('❌ TXT處理失敗:', error);
            this.log(`❌ 處理失敗: ${error.message}`);
        }
    }

    // 建立法院和案件類型映射
    buildMappings() {
        // 法院代碼映射（從文件名解析）
        this.courtMapping.set('SJ', '三重簡易庭');
        this.courtMapping.set('CL', '中壢簡易庭');
        this.courtMapping.set('NH', '內湖簡易庭');
        this.courtMapping.set('BD', '北斗簡易庭');
        this.courtMapping.set('BG', '北港簡易庭');
        // 可以根據發現的法院代碼繼續添加

        // 案件類型映射
        this.caseTypeMapping.set('刑事訴訟', '刑事');
        this.caseTypeMapping.set('刑事其他', '刑事');
        this.caseTypeMapping.set('民事訴訟', '民事');
        this.caseTypeMapping.set('民事非訟', '民事');
        this.caseTypeMapping.set('社會秩序維護法', '行政');
    }

    // 掃描所有TXT文件
    async scanTxtFiles() {
        const txtFiles = [];

        const scanDirectory = (dirPath) => {
            try {
                const items = fs.readdirSync(dirPath);

                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        scanDirectory(fullPath); // 遞歸掃描
                    } else if (item.toLowerCase().endsWith('.txt')) {
                        txtFiles.push({
                            path: fullPath,
                            name: item,
                            size: stat.size,
                            relativePath: path.relative(this.extractedPath, fullPath)
                        });
                    }
                }
            } catch (error) {
                this.errorLog.push(`掃描目錄失敗 ${dirPath}: ${error.message}`);
            }
        };

        if (fs.existsSync(this.extractedPath)) {
            scanDirectory(this.extractedPath);
        } else {
            throw new Error(`提取目錄不存在: ${this.extractedPath}`);
        }

        this.stats.totalFiles = txtFiles.length;
        return txtFiles;
    }

    // 處理所有TXT文件
    async processTxtFiles(txtFiles) {
        console.log('📝 開始處理TXT文件...');

        const batchSize = 50; // 每批處理50個文件

        for (let i = 0; i < txtFiles.length; i += batchSize) {
            const batch = txtFiles.slice(i, i + batchSize);
            console.log(`📦 處理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(txtFiles.length/batchSize)} (${batch.length} 個文件)`);

            // 並行處理當前批次
            const promises = batch.map(file => this.processSingleTxtFile(file));
            await Promise.all(promises);

            // 顯示進度
            const progress = Math.round(((i + batch.length) / txtFiles.length) * 100);
            console.log(`📊 進度: ${progress}% (${this.stats.processedFiles}/${this.stats.totalFiles})`);
        }
    }

    // 處理單個TXT文件
    async processSingleTxtFile(fileInfo) {
        try {
            const content = fs.readFileSync(fileInfo.path, 'utf8');
            const metadata = this.parseFileMetadata(fileInfo);
            const cases = this.parseFileContent(content, metadata);

            this.stats.processedFiles++;
            this.stats.totalCases += cases.length;

            // 合併到主數據集
            cases.forEach(caseData => {
                const caseId = this.generateCaseId(caseData);

                if (this.seenCaseIds.has(caseId)) {
                    this.stats.duplicates++;
                } else {
                    this.cases.set(caseId, caseData);
                    this.seenCaseIds.add(caseId);
                    this.stats.successfulImports++;
                }
            });

        } catch (error) {
            this.stats.failedImports++;
            this.errorLog.push(`文件 ${fileInfo.name} 處理錯誤: ${error.message}`);
            console.error(`❌ 文件處理失敗: ${fileInfo.name}`);
        }
    }

    // 解析文件元數據
    parseFileMetadata(fileInfo) {
        const fileName = fileInfo.name;
        const pathParts = fileInfo.relativePath.split(path.sep);

        // 解析文件名: 11208.SJEV.民事訴訟.txt
        const nameParts = fileName.replace('.txt', '').split('.');
        let yearMonth = '';
        let courtCode = '';
        let caseType = '';

        if (nameParts.length >= 3) {
            yearMonth = nameParts[0]; // 11208
            courtCode = nameParts[1]; // SJEV
            caseType = nameParts[2]; // 民事訴訟
        }

        // 從路徑解析法院信息
        let courtName = '';
        if (pathParts.length >= 2) {
            courtName = pathParts[pathParts.length - 2]; // 從父目錄名稱獲取
        }

        return {
            fileName,
            yearMonth,
            courtCode,
            caseType,
            courtName,
            fullPath: fileInfo.path,
            fileSize: fileInfo.size
        };
    }

    // 解析文件內容
    parseFileContent(content, metadata) {
        const cases = [];

        // 司法院TXT文件通常包含多個案件，每個案件一行或用特定分隔符
        const lines = content.split('\n').filter(line => line.trim());

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                const caseData = this.parseCaseLine(line, metadata, i + 1);
                if (caseData) {
                    cases.push(caseData);
                }
            } catch (error) {
                this.errorLog.push(`文件 ${metadata.fileName} 第 ${i + 1} 行解析錯誤: ${error.message}`);
            }
        }

        return cases;
    }

    // 解析單行案件數據
    parseCaseLine(line, metadata, lineNumber) {
        // 司法院TXT格式可能是分隔符文件（tab, pipe, 或其他）
        // 先嘗試不同的分隔符
        let fields = [];

        if (line.includes('\t')) {
            fields = line.split('\t');
        } else if (line.includes('|')) {
            fields = line.split('|');
        } else if (line.includes(',')) {
            fields = line.split(',');
        } else {
            // 如果沒有明顯分隔符，可能是固定寬度或其他格式
            // 暫時將整行作為內容
            fields = [line];
        }

        // 清理字段
        fields = fields.map(f => f.trim()).filter(f => f);

        if (fields.length === 0) return null;

        // 嘗試從字段中提取案件信息
        const caseData = {
            // 基本信息
            source: metadata.fileName,
            importDate: new Date().toISOString(),
            lineNumber: lineNumber,

            // 從文件元數據獲取
            JYEAR: this.extractYear(metadata.yearMonth),
            JCOURT: metadata.courtName || this.courtMapping.get(metadata.courtCode.substring(0, 2)) || '未知法院',
            JCASE: this.normalizedCaseType(metadata.caseType),

            // 從內容提取
            rawContent: line,
            fields: fields
        };

        // 嘗試從內容中提取更多信息
        this.enrichCaseData(caseData, fields);

        return caseData;
    }

    // 豐富案件數據
    enrichCaseData(caseData, fields) {
        // 嘗試從字段中識別特定信息
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            // 嘗試識別案號
            const caseNumberMatch = field.match(/(\d+)/);
            if (caseNumberMatch && !caseData.JNO) {
                caseData.JNO = caseNumberMatch[1];
            }

            // 嘗試識別日期
            const dateMatch = field.match(/(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            if (dateMatch && !caseData.JDATE) {
                caseData.JDATE = field;
            }

            // 嘗試識別案由或內容
            if (field.length > 10 && !caseData.JTITLE) {
                caseData.JTITLE = field.substring(0, 100); // 限制長度
            }
        }

        // 如果沒有找到案號，使用行號
        if (!caseData.JNO) {
            caseData.JNO = caseData.lineNumber.toString();
        }

        // 設置默認案由
        if (!caseData.JTITLE) {
            caseData.JTITLE = caseData.JCASE + '案件';
        }
    }

    // 提取年度
    extractYear(yearMonth) {
        if (!yearMonth) return '113'; // 默認

        // yearMonth 格式如 "11208" (112年8月)
        const yearStr = yearMonth.substring(0, 3);
        return yearStr;
    }

    // 標準化案件類型
    normalizedCaseType(caseType) {
        return this.caseTypeMapping.get(caseType) || caseType || '其他';
    }

    // 生成案件ID
    generateCaseId(caseData) {
        return `${caseData.JYEAR}-${caseData.JCOURT}-${caseData.JCASE}-${caseData.JNO}`;
    }

    // 生成數據庫
    async generateDatabase() {
        console.log('🗄️  生成數據庫文件...');

        const database = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalCases: this.stats.successfulImports,
                dataSource: '司法院開放資料 - 終結案件TXT文件',
                processor: 'JudicialTxtProcessor v1.0',
                fileFormat: 'TXT',
                processingStats: this.stats
            },
            statistics: this.getStatistics(),
            cases: Array.from(this.cases.values())
        };

        // 寫入主數據庫文件
        fs.writeFileSync(this.outputPath, JSON.stringify(database, null, 2));
        console.log(`💾 數據庫已保存至: ${this.outputPath}`);

        // 生成分年度和分法院文件
        await this.generateCategorizedFiles();
    }

    // 生成分類文件
    async generateCategorizedFiles() {
        const yearlyData = new Map();
        const courtData = new Map();

        // 按年度和法院分組
        Array.from(this.cases.values()).forEach(caseData => {
            const year = caseData.JYEAR;
            const court = caseData.JCOURT;

            // 年度分組
            if (!yearlyData.has(year)) {
                yearlyData.set(year, []);
            }
            yearlyData.get(year).push(caseData);

            // 法院分組
            if (!courtData.has(court)) {
                courtData.set(court, []);
            }
            courtData.get(court).push(caseData);
        });

        // 生成年度文件
        for (const [year, cases] of yearlyData) {
            const yearFile = `./judicial_cases_${year}.json`;
            const yearDatabase = {
                metadata: {
                    year: year,
                    generatedAt: new Date().toISOString(),
                    totalCases: cases.length,
                    dataSource: '司法院開放資料'
                },
                cases: cases
            };

            fs.writeFileSync(yearFile, JSON.stringify(yearDatabase, null, 2));
            console.log(`📅 ${year}年數據: ${yearFile} (${cases.length} 筆)`);
        }

        // 生成法院文件（只輸出前5個最大的）
        const topCourts = Array.from(courtData.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 5);

        for (const [court, cases] of topCourts) {
            const courtFile = `./judicial_cases_${court.replace(/[<>:"/\\|?*]/g, '_')}.json`;
            const courtDatabase = {
                metadata: {
                    court: court,
                    generatedAt: new Date().toISOString(),
                    totalCases: cases.length,
                    dataSource: '司法院開放資料'
                },
                cases: cases
            };

            fs.writeFileSync(courtFile, JSON.stringify(courtDatabase, null, 2));
            console.log(`⚖️  ${court}: ${courtFile} (${cases.length} 筆)`);
        }
    }

    // 獲取統計信息
    getStatistics() {
        const yearDistribution = {};
        const caseTypeDistribution = {};
        const courtDistribution = {};

        Array.from(this.cases.values()).forEach(caseData => {
            // 年度分布
            const year = caseData.JYEAR;
            yearDistribution[year] = (yearDistribution[year] || 0) + 1;

            // 案件類型分布
            const caseType = caseData.JCASE;
            if (caseType) {
                caseTypeDistribution[caseType] = (caseTypeDistribution[caseType] || 0) + 1;
            }

            // 法院分布
            const court = caseData.JCOURT;
            if (court) {
                courtDistribution[court] = (courtDistribution[court] || 0) + 1;
            }
        });

        return {
            yearDistribution,
            caseTypeDistribution,
            courtDistribution: Object.fromEntries(
                Object.entries(courtDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10) // 只保留前10個法院
            )
        };
    }

    // 生成處理報告
    generateReport() {
        const duration = Date.now() - this.stats.startTime;
        const report = {
            處理統計: {
                總文件數: this.stats.totalFiles,
                處理文件數: this.stats.processedFiles,
                發現案件數: this.stats.totalCases,
                成功導入: this.stats.successfulImports,
                重複案件: this.stats.duplicates,
                失敗導入: this.stats.failedImports,
                處理時間: `${Math.round(duration / 1000)}秒`
            },
            數據品質: {
                成功率: `${Math.round((this.stats.successfulImports / this.stats.totalCases) * 100)}%`,
                重複率: `${Math.round((this.stats.duplicates / this.stats.totalCases) * 100)}%`,
                錯誤率: `${Math.round((this.stats.failedImports / this.stats.totalFiles) * 100)}%`
            }
        };

        console.log('\n📋 處理報告:');
        console.table(report.處理統計);
        console.table(report.數據品質);

        // 保存詳細報告
        const detailedReport = {
            ...report,
            errorLog: this.errorLog.slice(0, 100), // 只保留前100個錯誤
            statistics: this.getStatistics(),
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('./txt_processing_report.json', JSON.stringify(detailedReport, null, 2));
        console.log('📄 詳細報告已保存至: txt_processing_report.json');

        // 顯示統計摘要
        const stats = this.getStatistics();
        console.log('\n📊 數據摘要:');
        console.log('年度分布:', Object.keys(stats.yearDistribution).sort());
        console.log('法院數量:', Object.keys(stats.courtDistribution).length);
        console.log('案件類型:', Object.keys(stats.caseTypeDistribution));
    }

    // 記錄日誌
    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(this.logPath, logEntry);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    const processor = new JudicialTxtProcessor();
    processor.run().catch(console.error);
}

module.exports = JudicialTxtProcessor;
