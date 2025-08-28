// bulk_downloader.js - 司法院開放資料批量下載器
// 配合 API 開放時間 (晚上10點-早上6點) 自動下載所有數據集

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置設定
const CONFIG = {
    // API 開放時間檢查 (00:00-06:00)
    ALLOWED_HOURS: { start: 24, end: 6 },

    // 下載設定
    DOWNLOAD_DIR: './downloads',
    CONCURRENT_DOWNLOADS: 3, // 同時下載數量
    RETRY_ATTEMPTS: 3,
    DELAY_BETWEEN_BATCHES: 4000, // 2秒延遲

    // API 設定
    API_BASE: 'https://opendata.judicial.gov.tw/api/FilesetLists',

    // 你的 API Token (如果需要)
    API_TOKEN: process.env.JUDICIAL_API_TOKEN || '', // 從環境變數讀取

    // 過濾設定
    EXCLUDE_FORMATS: ['PDF'], // 排除的檔案格式
    INCLUDE_ONLY_YEARS: [], // 如果設定，只下載特定年份 ['114', '113']
    INCLUDE_ONLY_FORMATS: ['7Z', 'JSON', 'CSV'] // 只下載這些格式
};

class JudicialDataDownloader {
    constructor() {
        this.datasets = [];
        this.downloadQueue = [];
        this.downloadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            totalSize: 0
        };
        this.activeDownloads = 0;
    }

    // 檢查是否在 API 開放時間內 - FIXED: Force allow for manual execution
    isApiAvailable() {
        const now = new Date();
        const hour = now.getHours();

        console.log(`🕐 當前時間: ${now.toLocaleString()} (小時: ${hour})`);

        // 22:00-23:59 或 00:00-06:00
        const isInRange = hour >= CONFIG.ALLOWED_HOURS.start || hour <= CONFIG.ALLOWED_HOURS.end;

        // OVERRIDE: Always allow during manual execution if user confirms time window
        const manualOverride = process.env.FORCE_DOWNLOAD === 'true' || process.argv.includes('--force');

        if (!isInRange && !manualOverride) {
            const nextStart = hour <= CONFIG.ALLOWED_HOURS.end ?
                `今天 ${CONFIG.ALLOWED_HOURS.start}:00` :
                `明天 ${CONFIG.ALLOWED_HOURS.start}:00`;
            console.log(`⏰ API 目前不可用。下次開放時間: ${nextStart}`);
            console.log(`💡 提示: 使用 --force 參數強制執行下載`);
        }

        return isInRange || manualOverride;
    }

    // 載入數據集清單
    async loadDatasets() {
        try {
            const data = fs.readFileSync('./judicial_datasets.json', 'utf8');
            this.datasets = JSON.parse(data);
            console.log(`📊 載入 ${this.datasets.length} 個數據集`);
        } catch (error) {
            console.error('❌ 無法載入數據集清單:', error.message);
            process.exit(1);
        }
    }

    // 生成所有下載連結
    generateDownloadUrls() {
        const urls = [];

        this.datasets.forEach(dataset => {
            const { datasetId, title, filesets } = dataset;

            // 過濾年份 (如果設定)
            if (CONFIG.INCLUDE_ONLY_YEARS.length > 0) {
                const hasTargetYear = CONFIG.INCLUDE_ONLY_YEARS.some(year =>
                    title.includes(year + '年')
                );
                if (!hasTargetYear) return;
            }

            filesets.forEach(fileset => {
                const { fileSetId, resourceFormat, resourceDescription } = fileset;

                // 過濾格式
                if (CONFIG.EXCLUDE_FORMATS.includes(resourceFormat)) return;
                if (CONFIG.INCLUDE_ONLY_FORMATS.length > 0 &&
                    !CONFIG.INCLUDE_ONLY_FORMATS.includes(resourceFormat)) return;

                urls.push({
                    url: `${CONFIG.API_BASE}/${fileSetId}/file`,
                    fileSetId,
                    datasetId,
                    title,
                    format: resourceFormat,
                    description: resourceDescription,
                    filename: this.generateFilename(title, resourceDescription, resourceFormat)
                });
            });
        });

        console.log(`🔗 生成 ${urls.length} 個下載連結`);
        return urls;
    }

    // 生成檔案名稱
    generateFilename(title, description, format) {
        // 清理檔案名稱
        const cleanTitle = title
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100);

        const cleanDesc = description
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        const timestamp = new Date().toISOString().slice(0, 10);
        return `${cleanTitle}_${cleanDesc}_${timestamp}.${format.toLowerCase()}`;
    }

    // 建立下載目錄
    ensureDownloadDir() {
        if (!fs.existsSync(CONFIG.DOWNLOAD_DIR)) {
            fs.mkdirSync(CONFIG.DOWNLOAD_DIR, { recursive: true });
            console.log(`📁 建立下載目錄: ${CONFIG.DOWNLOAD_DIR}`);
        }
    }

    // 下載單一檔案
    async downloadFile(item) {
        return new Promise((resolve) => {
            const { url, filename, title, description } = item;
            const filePath = path.join(CONFIG.DOWNLOAD_DIR, filename);

            // 檢查檔案是否已存在
            if (fs.existsSync(filePath)) {
                console.log(`⏭️  跳過已存在檔案: ${filename}`);
                this.downloadStats.skipped++;
                resolve({ success: true, skipped: true });
                return;
            }

            console.log(`⬇️  開始下載: ${title.substring(0, 50)}...`);

            const request = url.startsWith('https') ? https : http;
            const options = {
                headers: CONFIG.API_TOKEN ? {
                    'Authorization': `Bearer ${CONFIG.API_TOKEN}`,
                    'User-Agent': 'JudicialDataDownloader/1.0'
                } : {
                    'User-Agent': 'JudicialDataDownloader/1.0'
                }
            };

            const req = request.get(url, options, (res) => {
                if (res.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filePath);
                    let downloadedSize = 0;

                    res.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                    });

                    res.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        this.downloadStats.completed++;
                        this.downloadStats.totalSize += downloadedSize;
                        console.log(`✅ 完成下載: ${filename} (${this.formatSize(downloadedSize)})`);
                        resolve({ success: true, size: downloadedSize });
                    });

                    fileStream.on('error', (err) => {
                        fs.unlinkSync(filePath).catch(() => {}); // 清理失敗的檔案
                        console.error(`❌ 寫入失敗: ${filename}`, err.message);
                        this.downloadStats.failed++;
                        resolve({ success: false, error: err.message });
                    });
                } else {
                    console.error(`❌ HTTP 錯誤 ${res.statusCode}: ${filename}`);
                    this.downloadStats.failed++;
                    resolve({ success: false, error: `HTTP ${res.statusCode}` });
                }
            });

            req.on('error', (err) => {
                console.error(`❌ 請求失敗: ${filename}`, err.message);
                this.downloadStats.failed++;
                resolve({ success: false, error: err.message });
            });

            req.setTimeout(30000, () => {
                req.destroy();
                console.error(`❌ 下載超時: ${filename}`);
                this.downloadStats.failed++;
                resolve({ success: false, error: 'Timeout' });
            });
        });
    }

    // 格式化檔案大小
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    // 批量下載處理器
    async processBatchDownloads(urls) {
        this.downloadStats.total = urls.length;
        console.log(`🚀 開始批量下載 ${urls.length} 個檔案 (並發數: ${CONFIG.CONCURRENT_DOWNLOADS})`);

        const chunks = [];
        for (let i = 0; i < urls.length; i += CONFIG.CONCURRENT_DOWNLOADS) {
            chunks.push(urls.slice(i, i + CONFIG.CONCURRENT_DOWNLOADS));
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`\n📦 處理批次 ${i + 1}/${chunks.length} (${chunk.length} 個檔案)`);

            // 並發下載當前批次
            const promises = chunk.map(item => this.downloadFile(item));
            await Promise.all(promises);

            // 批次間延遲
            if (i < chunks.length - 1) {
                console.log(`⏸️  批次延遲 ${CONFIG.DELAY_BETWEEN_BATCHES}ms...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
            }

            // 顯示進度
            const progress = Math.round(((i + 1) / chunks.length) * 100);
            console.log(`📊 進度: ${progress}% (${this.downloadStats.completed}/${this.downloadStats.total})`);
        }
    }

    // 生成下載報告
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.downloadStats,
            summary: {
                success_rate: Math.round((this.downloadStats.completed / this.downloadStats.total) * 100),
                total_size_formatted: this.formatSize(this.downloadStats.totalSize),
                duration: Date.now() - this.startTime
            }
        };

        const reportPath = path.join(CONFIG.DOWNLOAD_DIR, `download_report_${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\n📋 下載報告:');
        console.log(`✅ 成功: ${report.stats.completed}`);
        console.log(`❌ 失敗: ${report.stats.failed}`);
        console.log(`⏭️  跳過: ${report.stats.skipped}`);
        console.log(`📊 成功率: ${report.summary.success_rate}%`);
        console.log(`💾 總大小: ${report.summary.total_size_formatted}`);
        console.log(`⏱️  耗時: ${Math.round(report.summary.duration / 1000)}秒`);
        console.log(`📄 報告儲存至: ${reportPath}`);
    }

    // 主執行流程
    async run() {
        console.log('🏛️  司法院開放資料批量下載器啟動');

        // 檢查 API 可用性
        if (!this.isApiAvailable()) {
            console.log('❌ 目前不在 API 開放時間內，程式結束');
            return;
        }

        this.startTime = Date.now();

        try {
            // 載入數據集
            await this.loadDatasets();

            // 生成下載連結
            const urls = this.generateDownloadUrls();

            if (urls.length === 0) {
                console.log('⚠️  沒有符合條件的檔案需要下載');
                return;
            }

            // 建立下載目錄
            this.ensureDownloadDir();

            // 開始下載
            await this.processBatchDownloads(urls);

            // 生成報告
            this.generateReport();

        } catch (error) {
            console.error('❌ 下載過程發生錯誤:', error);
        }
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    const downloader = new JudicialDataDownloader();
    downloader.run().catch(console.error);
}

module.exports = JudicialDataDownloader;
