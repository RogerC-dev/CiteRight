const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs/promises');
const cron = require('node-cron');
// Load .env if present
try {
    require('dotenv').config();
    console.log('[Init] dotenv loaded');
} catch (e) {
    // optional
}

// --- 0. INITIAL SETUP ---

const app = express();
const PORT = process.env.PORT || 3002; // Changed to port 3002 to avoid all conflicts
const DB_PATH = './judgments_db.json';

// Track last sync status for diagnostics
let lastSyncStatus = {
    lastStart: null,
    lastEnd: null,
app.get('/api/sync-status', (req, res) => {
    res.json(lastSyncStatus);
});

app.get('/api/auth-test', async (req, res) => {
    const user = (req.query.user || process.env.JUDICIAL_USER || '').trim();
    const password = (req.query.pass || process.env.JUDICIAL_PASS || '').trim();
    if (!user || !password) {
        return res.status(400).json({ error: 'Missing credentials (user/pass query params or env vars).' });
    }
    try {
        const token = await authenticate(user, password);
        res.json({ success: true, tokenPreview: token.slice(0, 10) + '...', message: 'Authentication succeeded' });
    } catch (e) {
        res.status(401).json({ success: false, error: e.message });
    }
});

app.get('/api/fetch-doc', async (req, res) => {
    const jid = req.query.jid;
    if (!jid) return res.status(400).json({ error: 'Missing jid query parameter' });
    const user = process.env.JUDICIAL_USER?.trim();
    const password = process.env.JUDICIAL_PASS?.trim();
    if (!user || !password) return res.status(400).json({ error: 'Server missing env credentials' });
    try {
        const token = await authenticate(user, password);
        const docResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JDoc', { token, j: jid });
        res.json({ success: true, data: docResponse.data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

    running: false,
    error: null,
    processed: 0,
    total: 0,
    addedCases: 0
};

async function authenticate(user, password) {
    console.log('[Auth] Authenticating...');
    try {
        const authResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/Auth', { user, password });
        console.log('[Auth] Raw response:', authResponse.data);
        if (authResponse.data.error) {
            throw new Error(authResponse.data.error);
        }
        if (!authResponse.data.Token) {
            throw new Error('No Token field in response');
        }
        console.log('[Auth] Success');
        return authResponse.data.Token;
    } catch (err) {
        if (err.response) {
            console.error('[Auth] Failed. Status:', err.response.status, 'Data:', err.response.data);
        } else {
            console.error('[Auth] Failed. Error:', err.message);
        }
        throw new Error('Authentication failed: ' + (err.response?.data?.error || err.message));
    }
}

// --- 1. CORE SYNC LOGIC ---

async function startSyncProcess() {
    if (lastSyncStatus.running) {
        console.log('[Sync] A sync is already running, skipping new request.');
        return;
    }
    lastSyncStatus.lastStart = new Date().toISOString();
    lastSyncStatus.running = true;
    lastSyncStatus.error = null;
    lastSyncStatus.processed = 0;
    lastSyncStatus.total = 0;
    lastSyncStatus.addedCases = 0;

    console.log(`[${new Date().toISOString()}] Starting nightly sync job...`);

    const user = process.env.JUDICIAL_USER?.trim();
    const password = process.env.JUDICIAL_PASS?.trim();

    if (!user || !password) {
        const msg = 'JUDICIAL_USER / JUDICIAL_PASS not set';
        console.error('Error:', msg);
        lastSyncStatus.error = msg;
        lastSyncStatus.running = false;
        lastSyncStatus.lastEnd = new Date().toISOString();
        return;
    }

    try {
        // Step 1: Authenticate and get Token
        console.log('Step 1: Authenticating with API...');
        const token = await authenticate(user, password);
        // Step 2: Get the list of updated cases
        console.log('Step 2: Fetching updated case list...');
        const listResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JList', { token });
        console.log('[JList] Raw response length:', Array.isArray(listResponse.data) ? listResponse.data.length : 'n/a');
        const jidList = listResponse.data.flatMap(day => day.list);
        lastSyncStatus.total = jidList.length;
        console.log(`Found ${jidList.length} cases to update/add.`);

        if (jidList.length === 0) {
            console.log('No new cases to sync. Job finished.');
            lastSyncStatus.lastEnd = new Date().toISOString();
            lastSyncStatus.running = false;
            return;
        }

        // Step 3: Fetch and save each case
        console.log('Step 3: Fetching individual case data...');
        let db = {};
        try {
            const fileContent = await fs.readFile(DB_PATH, 'utf-8');
            db = JSON.parse(fileContent);
            console.log(`Loaded existing database with ${Object.keys(db).length} cases.`);
        } catch (error) {
            console.log('Local database not found, creating a new one.');
        }

        let successCount = 0;
        for (let i = 0; i < jidList.length; i++) {
            const jid = jidList[i];
            try {
                console.log(`  Processing ${i + 1}/${jidList.length}: ${jid}`);
                const docResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JDoc', { token, j: jid });

                if (docResponse.data && docResponse.data.JID) {
                    db[docResponse.data.JID] = docResponse.data;
                    successCount++;
                    lastSyncStatus.addedCases = successCount;
                    console.log(`  - Synced: ${docResponse.data.JID} (${docResponse.data.JYEAR}年度${docResponse.data.JCASE}字第${docResponse.data.JNO}號)`);
                } else {
                    console.warn('  - No JID field in JDoc response for', jid);
                }
            } catch (error) {
                console.error(`  - Failed to sync jid: ${jid}. Error: ${error.message}`);
            }
            lastSyncStatus.processed = i + 1;
            // Polite delay
            await new Promise(resolve => setTimeout(resolve, 120));
        }

        await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`Sync complete. Successfully processed ${successCount} of ${jidList.length} cases.`);
        console.log(`Total cases in database: ${Object.keys(db).length}`);
    } catch (error) {
        console.error(`An error occurred during the sync process: ${error.message}`);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        lastSyncStatus.error = error.message;
    } finally {
        lastSyncStatus.running = false;
        lastSyncStatus.lastEnd = new Date().toISOString();
    }
}

// --- 2. CRON JOB SCHEDULER ---

// Schedule the sync job to run every hour, between 00:00 and 06:00.
cron.schedule('0 * 0-6 * * *', startSyncProcess, {
    timezone: "Asia/Taipei"
});

console.log('Nightly sync job scheduled to run between 00:00 and 06:00 Taiwan time.');

// --- 3. FRONTEND API ---

app.use(cors());
app.use(express.json());

app.get('/api/case', async (req, res) => {
    const { year, caseType, number } = req.query;

    // Special handling for constitutional interpretations (釋字) which don't have year
    if (caseType === '釋字') {
        if (!number) {
            return res.status(400).json({ error: 'Missing required query parameters for constitutional interpretation: caseType, number' });
        }

        try {
            const fileContent = await fs.readFile(DB_PATH, 'utf-8');
            const db = JSON.parse(fileContent);

            // Find constitutional interpretation case
            const foundCase = Object.values(db).find(caseData =>
                caseData.JCASE === '釋字' &&
                caseData.JNO === number
            );

            if (foundCase) {
                res.json({
                    success: true,
                    source: 'local_database',
                    data: foundCase,
                    caseNumber: `釋字第${number}號`
                });
            } else {
                res.status(404).json({
                    error: `Constitutional interpretation '釋字第${number}號' not found in local database.`,
                    suggestion: 'This interpretation may not be in our database yet.'
                });
            }
        } catch (error) {
            console.error("API Error: Could not read local database.", error);
            res.status(500).json({ error: 'Could not access the local case database.' });
        }
        return;
    }

    // Regular case handling
    if (!year || !caseType || !number) {
        return res.status(400).json({ error: 'Missing required query parameters: year, caseType, number' });
    }

    try {
        const fileContent = await fs.readFile(DB_PATH, 'utf-8');
        const db = JSON.parse(fileContent);

        // Find the case by iterating through the values
        const foundCase = Object.values(db).find(caseData =>
            caseData.JYEAR === year &&
            caseData.JCASE === caseType &&
            caseData.JNO === number
        );

        if (foundCase) {
            res.json({
                success: true,
                source: 'local_database',
                data: foundCase,
                caseNumber: `${year}年度${caseType}字第${number}號`
            });
        } else {
            res.status(404).json({
                error: `Case '${year}年度${caseType}字第${number}號' not found in local database.`,
                suggestion: 'This case may not be in our database yet. The sync runs nightly.'
            });
        }
    } catch (error) {
        console.error("API Error: Could not read local database.", error);
        res.status(500).json({ error: 'Could not access the local case database.' });
    }
});

// Manual sync endpoint for testing - support both GET and POST
app.post('/api/sync-now', async (req, res) => {
    res.json({ message: 'Manual sync started. Check console for progress.', timestamp: new Date().toISOString() });
    startSyncProcess();
});

// Add GET version for easy browser testing
app.get('/api/sync-now', async (req, res) => {
    res.json({ message: 'Manual sync started. Check console for progress.', timestamp: new Date().toISOString() });
    startSyncProcess();
});

// Database stats endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const fileContent = await fs.readFile(DB_PATH, 'utf-8');
        const db = JSON.parse(fileContent);
        const cases = Object.values(db);

        const stats = {
            totalCases: cases.length,
            yearDistribution: {},
            caseTypeDistribution: {},
            lastUpdated: new Date().toISOString()
        };

        cases.forEach(caseData => {
            const year = caseData.JYEAR;
            const caseType = caseData.JCASE;

            stats.yearDistribution[year] = (stats.yearDistribution[year] || 0) + 1;
            stats.caseTypeDistribution[caseType] = (stats.caseTypeDistribution[caseType] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({
            error: 'Could not read database statistics',
            details: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        message: 'CiteRight backend is running'
    });
});

// Add a homepage route
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>法源探測器 (CiteRight) 控制台</title>
            <style>
                body { font-family: "Microsoft JhengHei", Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
                .card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                .btn:hover { background: #0056b3; }
                .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; }
                .info { background: #cce7ff; border: 1px solid #b3d9ff; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔍 法源探測器 (CiteRight)</h1>
                <p>Taiwan Legal Case Recognition System</p>
            </div>
            
            <div class="card">
                <h3>🔧 系統控制</h3>
                <button class="btn" onclick="manualSync()">立即同步資料</button>
                <button class="btn" onclick="checkStats()">查看資料庫統計</button>
                <button class="btn" onclick="window.open('/health', '_blank')">系統健康檢查</button>
            </div>

            <div class="card">
                <h3>📊 快速狀態</h3>
                <div id="status" class="status info">載入中...</div>
                <div id="stats"></div>
            </div>

            <div class="card">
                <h3>🌐 API 端點</h3>
                <ul>
                    <li><strong>案件查詢:</strong> GET /api/case?year=110&caseType=台上&number=3214</li>
                    <li><strong>立即同步:</strong> POST /api/sync-now</li>
                    <li><strong>資料庫統計:</strong> GET /api/stats</li>
                    <li><strong>健康檢查:</strong> GET /health</li>
                </ul>
            </div>

            <script>
                function manualSync() {
                    document.getElementById('status').textContent = '正在觸發手動同步...';
                    fetch('/api/sync-now', { method: 'POST' })
                        .then(response => response.json())
                        .then(data => {
                            document.getElementById('status').textContent = '✅ 同步已觸發！請檢查控制台日誌';
                            document.getElementById('status').className = 'status success';
                        })
                        .catch(error => {
                            document.getElementById('status').textContent = '❌ 同步失敗: ' + error.message;
                        });
                }

                function checkStats() {
                    fetch('/api/stats')
                        .then(response => response.json())
                        .then(data => {
                            document.getElementById('stats').innerHTML = 
                                '<h4>資料庫統計:</h4>' +
                                '<p>總案件數: ' + data.totalCases + '</p>' +
                                '<p>最後更新: ' + new Date(data.lastUpdated).toLocaleString() + '</p>';
                        })
                        .catch(error => console.error('Error:', error));
                }

                // Load initial stats
                checkStats();
                document.getElementById('status').textContent = '✅ 系統運行正常';
                document.getElementById('status').className = 'status success';
            </script>
        </body>
        </html>
    `);
});

// --- 4. START SERVER ---

app.listen(PORT, () => {
    console.log(`法源探測器 (CiteRight) backend server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/case`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Database stats: http://localhost:${PORT}/api/stats`);
    console.log(`Manual sync: POST http://localhost:${PORT}/api/sync-now`);
    console.log('\nTo set up API credentials:');
    console.log('set JUDICIAL_USER=your_username');
    console.log('set JUDICIAL_PASS=your_password');
});

module.exports = app;
