// url_generator.js - 生成所有司法院開放資料下載連結
// 從 judicial_datasets.json 提取所有 fileSetId 並生成對應的 API 下載連結

const fs = require('fs');

class JudicialUrlGenerator {
    constructor() {
        this.datasets = [];
        this.urls = [];
    }

    // 載入數據集
    loadDatasets() {
        try {
            const data = fs.readFileSync('./judicial_datasets.json', 'utf8');
            this.datasets = JSON.parse(data);
            console.log(`📊 載入 ${this.datasets.length} 個數據集`);
            return true;
        } catch (error) {
            console.error('❌ 無法載入 judicial_datasets.json:', error.message);
            return false;
        }
    }

    // 生成所有下載連結
    generateUrls() {
        const urls = [];
        let totalFilesets = 0;

        this.datasets.forEach(dataset => {
            const { datasetId, title, filesets } = dataset;

            filesets.forEach(fileset => {
                const { fileSetId, resourceFormat, resourceDescription } = fileset;
                totalFilesets++;

                const downloadUrl = `https://opendata.judicial.gov.tw/api/FilesetLists/${fileSetId}/file`;

                urls.push({
                    fileSetId: fileSetId,
                    url: downloadUrl,
                    datasetId: datasetId,
                    title: title,
                    format: resourceFormat,
                    description: resourceDescription,
                    // 用於分類
                    year: this.extractYear(title),
                    category: this.categorizeDataset(title, resourceDescription)
                });
            });
        });

        console.log(`🔗 生成 ${urls.length} 個下載連結`);
        this.urls = urls;
        return urls;
    }

    // 提取年份
    extractYear(title) {
        const yearMatch = title.match(/(\d{2,3})年/);
        return yearMatch ? yearMatch[1] : 'unknown';
    }

    // 分類數據集
    categorizeDataset(title, description) {
        if (title.includes('裁判書用語辭典')) return 'dictionary';
        if (title.includes('法拍屋')) return 'auction';
        if (title.includes('統計')) return 'statistics';
        if (title.includes('決算')) return 'budget';
        if (description.includes('終結案件資料')) return 'case_data';
        if (description.includes('欄位說明')) return 'field_description';
        return 'other';
    }

    // 按格式分組
    groupByFormat() {
        const grouped = {};
        this.urls.forEach(item => {
            if (!grouped[item.format]) {
                grouped[item.format] = [];
            }
            grouped[item.format].push(item);
        });
        return grouped;
    }

    // 按年份分組
    groupByYear() {
        const grouped = {};
        this.urls.forEach(item => {
            if (!grouped[item.year]) {
                grouped[item.year] = [];
            }
            grouped[item.year].push(item);
        });
        return grouped;
    }

    // 按分類分組
    groupByCategory() {
        const grouped = {};
        this.urls.forEach(item => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });
        return grouped;
    }

    // 輸出純連結清單
    exportPlainUrls(filename = 'download_urls.txt') {
        const content = this.urls.map(item => item.url).join('\n');
        fs.writeFileSync(filename, content, 'utf8');
        console.log(`📄 純連結清單已儲存至: ${filename}`);
        return content;
    }

    // 輸出詳細連結資訊
    exportDetailedUrls(filename = 'detailed_urls.json') {
        fs.writeFileSync(filename, JSON.stringify(this.urls, null, 2), 'utf8');
        console.log(`📋 詳細連結資訊已儲存至: ${filename}`);
    }

    // 輸出 curl 命令腳本
    exportCurlScript(filename = 'download_all.sh') {
        const curlCommands = this.urls.map(item => {
            const safeFilename = this.sanitizeFilename(item.title, item.description, item.format);
            return `curl -L "${item.url}" -o "downloads/${safeFilename}" --create-dirs`;
        });

        const script = `#!/bin/bash
# 司法院開放資料批量下載腳本
# 生成時間: ${new Date().toISOString()}
# 總檔案數: ${this.urls.length}

mkdir -p downloads

echo "開始下載 ${this.urls.length} 個檔案..."

${curlCommands.join('\n')}

echo "下載完成！"
`;

        fs.writeFileSync(filename, script, 'utf8');
        console.log(`🐚 Curl 下載腳本已儲存至: ${filename}`);
    }

    // 輸出 PowerShell 腳本
    exportPowerShellScript(filename = 'download_all.ps1') {
        const powershellCommands = this.urls.map(item => {
            const safeFilename = this.sanitizeFilename(item.title, item.description, item.format);
            return `Invoke-WebRequest -Uri "${item.url}" -OutFile "downloads\\${safeFilename}"`;
        });

        const script = `# 司法院開放資料批量下載腳本 (PowerShell)
# 生成時間: ${new Date().toISOString()}
# 總檔案數: ${this.urls.length}

New-Item -ItemType Directory -Force -Path "downloads"

Write-Host "開始下載 ${this.urls.length} 個檔案..."

${powershellCommands.join('\n')}

Write-Host "下載完成！"
`;

        fs.writeFileSync(filename, script, 'utf8');
        console.log(`🔷 PowerShell 下載腳本已儲存至: ${filename}`);
    }

    // 清理檔案名稱
    sanitizeFilename(title, description, format) {
        const cleanTitle = title
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 80);

        const timestamp = new Date().toISOString().slice(0, 10);
        return `${cleanTitle}_${timestamp}.${format.toLowerCase()}`;
    }

    // 生成統計報告
    generateStats() {
        const stats = {
            總檔案數: this.urls.length,
            按格式分類: {},
            按年份分類: {},
            按類別分類: {}
        };

        // 統計格式
        this.urls.forEach(item => {
            stats.按格式分類[item.format] = (stats.按格式分類[item.format] || 0) + 1;
            stats.按年份分類[item.year] = (stats.按年份分類[item.year] || 0) + 1;
            stats.按類別分類[item.category] = (stats.按類別分類[item.category] || 0) + 1;
        });

        return stats;
    }

    // 主執行流程
    run() {
        console.log('🔗 司法院開放資料連結生成器');

        // 載入數據集
        if (!this.loadDatasets()) {
            return;
        }

        // 生成連結
        this.generateUrls();

        // 輸出各種格式
        this.exportPlainUrls();
        this.exportDetailedUrls();
        this.exportCurlScript();
        this.exportPowerShellScript();

        // 顯示統計
        const stats = this.generateStats();
        console.log('\n📊 統計資訊:');
        console.log('按格式分類:', stats.按格式分類);
        console.log('按年份分類:', Object.keys(stats.按年份分類).sort().reduce((obj, key) => {
            obj[key] = stats.按年份分類[key];
            return obj;
        }, {}));

        console.log('\n✅ 所有連結和腳本已生成完成！');
        console.log('📁 請查看以下檔案:');
        console.log('  - download_urls.txt (純連結清單)');
        console.log('  - detailed_urls.json (詳細資訊)');
        console.log('  - download_all.sh (Linux/Mac 下載腳本)');
        console.log('  - download_all.ps1 (Windows PowerShell 腳本)');
    }
}

// 執行生成器
if (require.main === module) {
    const generator = new JudicialUrlGenerator();
    generator.run();
}

module.exports = JudicialUrlGenerator;
