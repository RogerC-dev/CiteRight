// data_analyzer.js - 分析提取的司法院數據並創建適當的導入器
// 智能檢測文件格式並處理各種可能的數據結構

const fs = require('fs');
const path = require('path');

class JudicialDataAnalyzer {
    constructor() {
        this.extractedPath = './extracted_data';
        this.results = {
            totalFolders: 0,
            totalFiles: 0,
            fileTypes: new Map(),
            sampleFiles: [],
            folderStructure: [],
            detectedFormats: new Set()
        };
    }

    async analyze() {
        console.log('🔍 開始分析提取的司法院數據...');

        if (!fs.existsSync(this.extractedPath)) {
            console.error('❌ 提取目錄不存在:', this.extractedPath);
            return;
        }

        await this.scanDirectory(this.extractedPath, 0);
        this.generateReport();
        this.suggestProcessor();
    }

    async scanDirectory(dirPath, depth = 0) {
        try {
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    this.results.totalFolders++;

                    // 記錄文件夾結構（僅前3層）
                    if (depth < 3) {
                        this.results.folderStructure.push({
                            path: fullPath.replace(this.extractedPath, ''),
                            depth: depth,
                            name: item
                        });
                    }

                    // 遞歸掃描子目錄（限制深度避免無限循環）
                    if (depth < 10) {
                        await this.scanDirectory(fullPath, depth + 1);
                    }
                } else {
                    this.results.totalFiles++;

                    // 分析文件類型
                    const ext = path.extname(item).toLowerCase();
                    const count = this.results.fileTypes.get(ext) || 0;
                    this.results.fileTypes.set(ext, count + 1);

                    // 收集樣本文件
                    if (this.results.sampleFiles.length < 20) {
                        this.results.sampleFiles.push({
                            name: item,
                            path: fullPath,
                            size: stat.size,
                            extension: ext,
                            depth: depth
                        });
                    }

                    // 檢測可能的數據格式
                    this.detectDataFormat(item, fullPath, ext);
                }
            }
        } catch (error) {
            console.warn(`⚠️  無法讀取目錄 ${dirPath}: ${error.message}`);
        }
    }

    detectDataFormat(fileName, filePath, extension) {
        // 檢測CSV文件
        if (extension === '.csv') {
            this.results.detectedFormats.add('CSV');
        }

        // 檢測JSON文件
        if (extension === '.json') {
            this.results.detectedFormats.add('JSON');
        }

        // 檢測XML文件
        if (extension === '.xml') {
            this.results.detectedFormats.add('XML');
        }

        // 檢測TXT文件（可能是分隔符文件）
        if (extension === '.txt') {
            this.results.detectedFormats.add('TXT');
        }

        // 檢測Excel文件
        if (['.xlsx', '.xls'].includes(extension)) {
            this.results.detectedFormats.add('Excel');
        }

        // 檢測其他數據文件
        if (['.tsv', '.dat', '.data'].includes(extension)) {
            this.results.detectedFormats.add('TabDelimited');
        }

        // 如果沒有擴展名但文件名包含數據關鍵字
        if (!extension && (
            fileName.includes('data') ||
            fileName.includes('案件') ||
            fileName.includes('判決') ||
            fileName.includes('court')
        )) {
            this.results.detectedFormats.add('UnknownData');
        }
    }

    generateReport() {
        console.log('\n📊 數據分析報告:');
        console.log('='.repeat(50));

        console.log(`📁 總文件夾數: ${this.results.totalFolders}`);
        console.log(`📄 總文件數: ${this.results.totalFiles}`);

        console.log('\n📋 文件類型分布:');
        const sortedTypes = Array.from(this.results.fileTypes.entries())
            .sort((a, b) => b[1] - a[1]);

        for (const [ext, count] of sortedTypes) {
            const percentage = ((count / this.results.totalFiles) * 100).toFixed(1);
            console.log(`  ${ext || '(無擴展名)'}: ${count} 個文件 (${percentage}%)`);
        }

        console.log('\n🗂️  文件夾結構樣本:');
        this.results.folderStructure.slice(0, 10).forEach(folder => {
            const indent = '  '.repeat(folder.depth);
            console.log(`${indent}📁 ${folder.name}`);
        });

        console.log('\n📄 樣本文件:');
        this.results.sampleFiles.slice(0, 10).forEach(file => {
            const sizeKB = (file.size / 1024).toFixed(1);
            console.log(`  📄 ${file.name} (${sizeKB} KB) - 深度: ${file.depth}`);
        });

        console.log('\n🔍 檢測到的數據格式:');
        Array.from(this.results.detectedFormats).forEach(format => {
            console.log(`  ✅ ${format}`);
        });

        // 保存詳細報告
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFolders: this.results.totalFolders,
                totalFiles: this.results.totalFiles,
                detectedFormats: Array.from(this.results.detectedFormats)
            },
            fileTypes: Object.fromEntries(this.results.fileTypes),
            folderStructure: this.results.folderStructure,
            sampleFiles: this.results.sampleFiles
        };

        fs.writeFileSync('./data_analysis_report.json', JSON.stringify(reportData, null, 2));
        console.log('\n💾 詳細報告已保存至: data_analysis_report.json');
    }

    suggestProcessor() {
        console.log('\n💡 處理建議:');
        console.log('='.repeat(50));

        if (this.results.detectedFormats.has('CSV')) {
            console.log('✅ 檢測到CSV文件 - 可以使用csv_importer.js');
        }

        if (this.results.detectedFormats.has('JSON')) {
            console.log('✅ 檢測到JSON文件 - 建議創建JSON處理器');
        }

        if (this.results.detectedFormats.has('XML')) {
            console.log('✅ 檢測到XML文件 - 建議創建XML處理器');
        }

        if (this.results.detectedFormats.has('UnknownData')) {
            console.log('⚠️  檢測到未知格式文件 - 需要進一步檢查');
        }

        if (this.results.totalFiles === 0) {
            console.log('❌ 沒有找到任何文件 - 請檢查提取是否成功');
        } else if (this.results.detectedFormats.size === 0) {
            console.log('⚠️  沒有檢測到已知的數據格式 - 可能需要自定義處理器');
        }

        // 根據最常見的文件類型提供具體建議
        const mostCommonType = Array.from(this.results.fileTypes.entries())
            .sort((a, b) => b[1] - a[1])[0];

        if (mostCommonType) {
            console.log(`\n🎯 最常見的文件類型: ${mostCommonType[0] || '(無擴展名)'} (${mostCommonType[1]} 個文件)`);

            if (mostCommonType[0] === '.csv') {
                console.log('建議使用: node csv_importer.js');
            } else if (!mostCommonType[0]) {
                console.log('建議: 檢查無擴展名文件的實際內容格式');
            } else {
                console.log(`建議: 創建針對 ${mostCommonType[0]} 格式的專用處理器`);
            }
        }
    }
}

// 運行分析器
if (require.main === module) {
    const analyzer = new JudicialDataAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = JudicialDataAnalyzer;
