// scheduler.js - 司法院開放資料定時下載排程器
// 自動在 API 開放時間 (22:00-06:00) 執行批量下載

const cron = require('node-cron');
const JudicialDataDownloader = require('./bulk_downloader');

class DownloadScheduler {
    constructor() {
        this.downloader = new JudicialDataDownloader();
        this.isRunning = false;
    }

    // 檢查當前時間是否在允許範圍內
    isWithinAllowedHours() {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 22 || hour <= 6;
    }

    // 執行下載任務
    async executeDownload() {
        if (this.isRunning) {
            console.log('⚠️  下載任務已在執行中，跳過此次排程');
            return;
        }

        if (!this.isWithinAllowedHours()) {
            console.log('⏰ 不在 API 開放時間內，等待下次排程');
            return;
        }

        console.log('\n🚀 排程觸發 - 開始執行批量下載');
        this.isRunning = true;

        try {
            await this.downloader.run();
            console.log('✅ 排程下載任務完成');
        } catch (error) {
            console.error('❌ 排程下載任務失敗:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // 啟動排程器
    start() {
        console.log('📅 司法院開放資料定時下載排程器啟動');
        console.log('⏰ API 開放時間: 22:00-06:00');

        // 每小時檢查一次 (在整點執行)
        cron.schedule('0 * * * *', async () => {
            const now = new Date();
            console.log(`\n⏰ 排程檢查 - ${now.toLocaleString()}`);
            await this.executeDownload();
        });

        // 也可以設定在 API 開放時間開始時立即執行
        // 每天 22:05 執行 (避免整點的系統負載)
        cron.schedule('5 22 * * *', async () => {
            console.log('\n🌙 夜間批量下載開始');
            await this.executeDownload();
        });

        // 凌晨 2:00 再執行一次 (備份時間)
        cron.schedule('0 2 * * *', async () => {
            console.log('\n🌌 凌晨備份下載開始');
            await this.executeDownload();
        });

        console.log('✅ 排程器已啟動，等待執行時間...');
        console.log('🔄 下次執行時間: 每天 22:05 和 02:00');

        // 立即檢查一次 (如果當前在允許時間內)
        if (this.isWithinAllowedHours()) {
            console.log('🚀 當前在 API 開放時間內，立即執行一次下載');
            setTimeout(() => this.executeDownload(), 5000);
        }
    }

    // 停止排程器
    stop() {
        console.log('⏹️  排程器停止');
        process.exit(0);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    const scheduler = new DownloadScheduler();

    // 優雅的退出處理
    process.on('SIGINT', () => {
        console.log('\n👋 收到停止信號，正在關閉排程器...');
        scheduler.stop();
    });

    process.on('SIGTERM', () => {
        console.log('\n👋 收到終止信號，正在關閉排程器...');
        scheduler.stop();
    });

    scheduler.start();
}

module.exports = DownloadScheduler;
