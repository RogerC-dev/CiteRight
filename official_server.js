const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs/promises');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3002; // Changed to port 3002 to avoid all conflicts
const DB_PATH = './judgments_db.json';

// --- 1. CORE SYNC LOGIC ---

async function startSyncProcess() {
    console.log(`[${new Date().toISOString()}] Starting nightly sync job...`);

    const user = process.env.JUDICIAL_USER;
    const password = process.env.JUDICIAL_PASS;

    if (!user || !password) {
        console.error("Error: JUDICIAL_USER and JUDICIAL_PASS environment variables are not set.");
        console.log("To set them, use:");
        console.log("set JUDICIAL_USER=your_username");
        console.log("set JUDICIAL_PASS=your_password");
        return;
    }

    try {
        // Step 1: Authenticate and get Token
        console.log("Step 1: Authenticating with API...");
        const authResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/Auth', {
            user,
            password
        });

        if (authResponse.data.error) {
            throw new Error(`Authentication failed: ${authResponse.data.error}`);
        }

        const token = authResponse.data.Token;
        console.log("Authentication successful. Token obtained.");

        // Step 2: Get the list of updated cases
        console.log("Step 2: Fetching updated case list...");
        const listResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JList', { token });
        const jidList = listResponse.data.flatMap(day => day.list);
        console.log(`Found ${jidList.length} cases to update/add.`);

        if (jidList.length === 0) {
            console.log("No new cases to sync. Job finished.");
            return;
        }

        // Step 3: Fetch and save each case
        console.log("Step 3: Fetching individual case data...");
        let db = {};
        try {
            const fileContent = await fs.readFile(DB_PATH, 'utf-8');
            db = JSON.parse(fileContent);
            console.log(`Loaded existing database with ${Object.keys(db).length} cases.`);
        } catch (error) {
            console.log("Local database not found, creating a new one.");
        }

        let successCount = 0;
        for (let i = 0; i < jidList.length; i++) {
            const jid = jidList[i];
            try {
                console.log(`  Processing ${i + 1}/${jidList.length}: ${jid}`);
                const docResponse = await axios.post('https://data.judicial.gov.tw/jdg/api/JDoc', {
                    token,
                    j: jid
                });

                if (docResponse.data && docResponse.data.JID) {
                    db[docResponse.data.JID] = docResponse.data;
                    successCount++;
                    console.log(`  - Synced: ${docResponse.data.JID} (${docResponse.data.JYEAR}年度${docResponse.data.JCASE}字第${docResponse.data.JNO}號)`);
                }

                // Add small delay to be respectful to the API
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`  - Failed to sync jid: ${jid}. Error: ${error.message}`);
            }
        }

        await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`Sync complete. Successfully processed ${successCount} of ${jidList.length} cases.`);
        console.log(`Total cases in database: ${Object.keys(db).length}`);

    } catch (error) {
        console.error(`An error occurred during the sync process: ${error.message}`);
        if (error.response) {
            console.error(`API Response:`, error.response.data);
        }
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

    if (!year || !caseType || !number) {
        return res.status(400).json({
            error: 'Missing required query parameters: year, caseType, number'
        });
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
            // Return the official case data
            res.json({
                success: true,
                source: 'official_api',
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

        if (error.code === 'ENOENT') {
            res.status(503).json({
                error: 'Local case database not found. Please run the nightly sync first.',
                action: 'Use /api/sync-now to manually trigger a sync.'
            });
        } else {
            res.status(500).json({
                error: 'Could not access the local case database.',
                details: error.message
            });
        }
    }
});

// Manual sync endpoint for testing
app.post('/api/sync-now', async (req, res) => {
    res.json({ message: 'Manual sync started. Check console for progress.' });
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
