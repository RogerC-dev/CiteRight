// csv_importer.js - 司法院CSV數據導入處理器
// 自動處理extracted_data中的所有CSV文件並導入API服務器

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class JudicialCsvImporter {
    constructor() {
        this.extractedPath = './extracted_data';
        this.outputPath = './imported_cases.json';
        this.logPath = './import_log.txt';

        this.stats = {
            totalFiles: 0,
            processedFiles: 0,
            totalCases: 0,
            successfulImports: 0,
            failedImports: 0,
            duplicates: 0,
            startTime: Date.now()
        };

        this.cases = new Map(); // Use Map to avoid duplicates
        this.seenCaseIds = new Set();
        this.errorLog = [];
    }

    // 主執行函數
    async run() {
        console.log('🏛️  司法院CSV數據導入器啟動');
        this.log('🚀 CSV導入處理開始');

        try {
            // 1. 掃描所有CSV文件
            const csvFiles = await this.scanCsvFiles();
            console.log(`📊 發現 ${csvFiles.length} 個CSV文件`);

            // 2. 處理每個CSV文件
            await this.processCsvFiles(csvFiles);

            // 3. 生成最終數據庫文件
            await this.generateDatabase();

            // 4. 生成統計報告
            this.generateReport();

            console.log('✅ CSV導入完成！');

        } catch (error) {
            console.error('❌ CSV導入失敗:', error);
            this.log(`❌ 導入失敗: ${error.message}`);
        }
    }

    // 掃描extracted_data中的所有CSV文件
    async scanCsvFiles() {
        const csvFiles = [];

        const scanDirectory = (dirPath) => {
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    scanDirectory(fullPath); // 遞歸掃描子目錄
                } else if (item.toLowerCase().endsWith('.csv')) {
                    csvFiles.push(fullPath);
                }
            }
        };

        if (fs.existsSync(this.extractedPath)) {
            scanDirectory(this.extractedPath);
        } else {
            throw new Error(`提取目錄不存在: ${this.extractedPath}`);
        }

        this.stats.totalFiles = csvFiles.length;
        return csvFiles;
    }

    // 處理所有CSV文件
    async processCsvFiles(csvFiles) {
        console.log('📝 開始處理CSV文件...');

        const batchSize = 10; // 每批處理10個文件

        for (let i = 0; i < csvFiles.length; i += batchSize) {
            const batch = csvFiles.slice(i, i + batchSize);
            console.log(`📦 處理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(csvFiles.length/batchSize)} (${batch.length} 個文件)`);

            // 並行處理當前批次
            const promises = batch.map(file => this.processSingleCsv(file));
            await Promise.all(promises);

            // 顯示進度
            const progress = Math.round(((i + batch.length) / csvFiles.length) * 100);
            console.log(`📊 進度: ${progress}% (${this.stats.processedFiles}/${this.stats.totalFiles})`);
        }
    }

    // 處理單個CSV文件
    async processSingleCsv(filePath) {
        return new Promise((resolve) => {
            const cases = [];
            const fileName = path.basename(filePath);

            console.log(`📄 處理: ${fileName}`);

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const caseData = this.parseCaseRow(row, fileName);
                        if (caseData) {
                            cases.push(caseData);
                        }
                    } catch (error) {
                        this.errorLog.push(`文件 ${fileName} 第 ${cases.length + 1} 行解析錯誤: ${error.message}`);
                    }
                })
                .on('end', () => {
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

                    resolve();
                })
                .on('error', (error) => {
                    this.stats.failedImports++;
                    this.errorLog.push(`文件 ${fileName} 讀取錯誤: ${error.message}`);
                    console.error(`❌ 文件處理失敗: ${fileName}`);
                    resolve();
                });
        });
    }

    // 解析CSV行數據
    parseCaseRow(row, fileName) {
        // 司法院CSV的常見欄位名稱（可能有變化）
        const possibleFields = {
            year: ['JYEAR', 'year', '年度', '年'],
            case: ['JCASE', 'case', '字別', '字'],
            number: ['JNO', 'number', '案號', '號'],
            title: ['JTITLE', 'title', '案由'],
            court: ['JCOURT', 'court', '法院'],
            date: ['JDATE', 'date', '日期'],
            content: ['JFULLCONTENT', 'JFULL', 'content', '判決內容', '全文'],
            level: ['JLEVEL', 'level', '審級'],
            result: ['JRESULT', 'result', '判決結果']
        };

        // 提取數據
        const caseData = {
            source: fileName,
            importDate: new Date().toISOString()
        };

        // 智能欄位映射
        for (const [key, possibleNames] of Object.entries(possibleFields)) {
            for (const name of possibleNames) {
                if (row[name] !== undefined && row[name] !== '') {
                    caseData[key.toUpperCase()] = String(row[name]).trim();
                    break;
                }
            }
        }

        // 數據驗證
        if (!caseData.JYEAR || !caseData.JCASE || !caseData.JNO) {
            return null; // 跳過不完整的記錄
        }

        // 標準化年度格式
        if (caseData.JYEAR) {
            caseData.JYEAR = String(caseData.JYEAR).replace(/[^\d]/g, '');
        }

        // 標準化案號格式
        if (caseData.JNO) {
            caseData.JNO = String(caseData.JNO).replace(/[^\d]/g, '');
        }

        return caseData;
    }

    // 生成唯一案件ID
    generateCaseId(caseData) {
        return `${caseData.JYEAR}-${caseData.JCASE}-${caseData.JNO}`;
    }

    // 生成最終數據庫文件
    async generateDatabase() {
        console.log('🗄️  生成數據庫文件...');

        const database = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalCases: this.stats.successfulImports,
                dataSource: '司法院開放資料',
                importer: 'JudicialCsvImporter v1.0'
            },
            statistics: this.getStatistics(),
            cases: Array.from(this.cases.values())
        };

        // 寫入主數據庫文件
        fs.writeFileSync(this.outputPath, JSON.stringify(database, null, 2));
        console.log(`💾 數據庫已保存至: ${this.outputPath}`);

        // 生成分年度文件
        await this.generateYearlyFiles();
    }

    // 生成分年度數據文件
    async generateYearlyFiles() {
        const yearlyData = new Map();

        // 按年度分組
        Array.from(this.cases.values()).forEach(caseData => {
            const year = caseData.JYEAR;
            if (!yearlyData.has(year)) {
                yearlyData.set(year, []);
            }
            yearlyData.get(year).push(caseData);
        });

        // 為每個年度生成單獨文件
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
            console.log(`📅 ${year}年數據已保存至: ${yearFile} (${cases.length} 筆)`);
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
            caseTypeDistribution: Object.fromEntries(
                Object.entries(caseTypeDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20) // 只保留前20種類型
            ),
            courtDistribution: Object.fromEntries(
                Object.entries(courtDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20) // 只保留前20個法院
            )
        };
    }

    // 生成導入報告
    generateReport() {
        const duration = Date.now() - this.stats.startTime;
        const report = {
            導入統計: {
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

        console.log('\n📋 導入報告:');
        console.table(report.導入統計);
        console.table(report.數據品質);

        // 保存詳細報告
        const detailedReport = {
            ...report,
            errorLog: this.errorLog,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('./import_report.json', JSON.stringify(detailedReport, null, 2));
        console.log('📄 詳細報告已保存至: import_report.json');

        // 如果有錯誤，顯示前5個
        if (this.errorLog.length > 0) {
            console.log('\n⚠️  錯誤摘要 (前5個):');
            this.errorLog.slice(0, 5).forEach(error => console.log(`  - ${error}`));
            if (this.errorLog.length > 5) {
                console.log(`  ... 還有 ${this.errorLog.length - 5} 個錯誤，請查看詳細報告`);
            }
        }
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
    const importer = new JudicialCsvImporter();
    importer.run().catch(console.error);
}

module.exports = JudicialCsvImporter;
