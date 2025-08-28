const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
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
const PORT = process.env.PORT || 3003; // Changed from 3002 to avoid conflicts

// UPDATED: Use the new processed judicial databases
const PROCESSED_DATA_DIR = './processed_data';
const INTERPRETATIONS_DB_PATH = path.join(PROCESSED_DATA_DIR, 'judicial_interpretations_db.json');
const COURT_CASES_DB_PATH = path.join(PROCESSED_DATA_DIR, 'court_cases_db.json');
const API_MAPPING_PATH = path.join(PROCESSED_DATA_DIR, 'api_mapping.json');

// Legacy paths for fallback
const MAIN_DB_PATH = './judicial_cases_database.json';
const LEGACY_DB_PATH = './judgments_db.json';

// NEW: Enhanced in-memory database for fast searching
let judicialDatabase = {
    metadata: {},
    interpretations: [],
    courtCases: [],
    searchIndex: new Map(),
    courtIndex: new Map(),
    yearIndex: new Map(),
    apiMapping: null,
    loadStatus: 'loading'
};

// Load the processed judicial databases
async function loadJudicialDatabase() {
    try {
        console.log('[DB] Loading processed judicial databases...');

        // Load interpretations database
        try {
            const interpretationsData = await fs.readFile(INTERPRETATIONS_DB_PATH, 'utf8');
            const interpretationsDB = JSON.parse(interpretationsData);
            judicialDatabase.interpretations = interpretationsDB.interpretations || [];
            judicialDatabase.metadata.interpretations = interpretationsDB.metadata;
            console.log(`[DB] ✅ Loaded ${judicialDatabase.interpretations.length} constitutional interpretations`);
        } catch (error) {
            console.warn('[DB] ⚠️ Could not load interpretations database:', error.message);
        }

        // Load court cases database
        try {
            const courtCasesData = await fs.readFile(COURT_CASES_DB_PATH, 'utf8');
            const courtCasesDB = JSON.parse(courtCasesData);
            judicialDatabase.courtCases = courtCasesDB.periods || [];
            judicialDatabase.metadata.courtCases = courtCasesDB.metadata;
            console.log(`[DB] ✅ Loaded ${judicialDatabase.courtCases.length} court case periods`);
        } catch (error) {
            console.warn('[DB] ⚠️ Could not load court cases database:', error.message);
        }

        // Load API mapping
        try {
            const apiMappingData = await fs.readFile(API_MAPPING_PATH, 'utf8');
            judicialDatabase.apiMapping = JSON.parse(apiMappingData);
            console.log('[DB] ✅ Loaded API mapping configuration');
        } catch (error) {
            console.warn('[DB] ⚠️ Could not load API mapping:', error.message);
        }

        // Build search indexes
        buildSearchIndexes();
        judicialDatabase.loadStatus = 'loaded';

        return true;
    } catch (error) {
        console.error('[DB] ❌ Failed to load processed databases:', error.message);
        console.log('[DB] 🔄 Attempting to load legacy databases...');

        return await loadLegacyDatabases();
    }
}

// Fallback to legacy databases
async function loadLegacyDatabases() {
    try {
        // Try main judicial database first
        try {
            const data = await fs.readFile(MAIN_DB_PATH, 'utf8');
            const database = JSON.parse(data);
            judicialDatabase.courtCases = database.cases || [];
            judicialDatabase.metadata = database.metadata || {};
            console.log(`[DB] 📚 Loaded ${judicialDatabase.courtCases.length} cases from main database`);
        } catch (mainError) {
            // Try legacy database
            const legacyData = await fs.readFile(LEGACY_DB_PATH, 'utf8');
            const legacyDb = JSON.parse(legacyData);
            judicialDatabase.courtCases = Object.values(legacyDb) || [];
            console.log(`[DB] 📚 Loaded ${judicialDatabase.courtCases.length} cases from legacy database`);
        }

        buildSearchIndexes();
        judicialDatabase.loadStatus = 'legacy';
        return true;
    } catch (error) {
        console.error('[DB] ❌ Failed to load any database:', error.message);
        judicialDatabase.loadStatus = 'failed';
        return false;
    }
}

// Build search indexes for fast case lookups
function buildSearchIndexes() {
    console.log('[DB] 🔍 Building search indexes...');

    judicialDatabase.searchIndex.clear();
    judicialDatabase.courtIndex.clear();
    judicialDatabase.yearIndex.clear();

    // Index constitutional interpretations
    judicialDatabase.interpretations.forEach((interpretation, index) => {
        const key = `釋字-${interpretation.number}`.toLowerCase();
        judicialDatabase.searchIndex.set(key, { type: 'interpretation', index });
    });

    // Index court cases (try both new and legacy formats)
    judicialDatabase.courtCases.forEach((caseData, index) => {
        let year, caseType, number, court;

        // Handle different data formats
        if (caseData.JYEAR) {
            // Legacy format
            year = caseData.JYEAR;
            caseType = caseData.JCASE;
            number = caseData.JNO;
            court = caseData.JCOURT;
        } else if (caseData.period) {
            // New processed format - extract from period info
            year = caseData.adYear || caseData.period.split('-')[0];
            // For processed data, we'll handle searches differently
        }

        if (year && caseType && number) {
            const caseKey = `${year}-${caseType}-${number}`.toLowerCase();
            judicialDatabase.searchIndex.set(caseKey, { type: 'case', index });

            // Court index
            if (court) {
                if (!judicialDatabase.courtIndex.has(court)) {
                    judicialDatabase.courtIndex.set(court, []);
                }
                judicialDatabase.courtIndex.get(court).push(index);
            }

            // Year index
            if (!judicialDatabase.yearIndex.has(year)) {
                judicialDatabase.yearIndex.set(year, []);
            }
            judicialDatabase.yearIndex.get(year).push(index);
        }
    });

    console.log(`[DB] ✅ Indexes built: ${judicialDatabase.searchIndex.size} lookups, ${judicialDatabase.courtIndex.size} courts, ${judicialDatabase.yearIndex.size} years`);
}

// --- 1. CORE SYNC LOGIC ---

// Sync status tracking
let lastSyncStatus = {
    running: false,
    lastStart: null,
    lastEnd: null,
    error: null,
    processed: 0,
    total: 0,
    addedCases: 0
};

const DB_PATH = './judgments_db.json'; // Legacy sync path

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

// --- 3. ENHANCED FRONTEND API ---

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            loadStatus: judicialDatabase.loadStatus,
            interpretations: judicialDatabase.interpretations.length,
            courtCases: judicialDatabase.courtCases.length,
            searchIndexSize: judicialDatabase.searchIndex.size
        }
    });
});

// Database statistics endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        statistics: {
            interpretations: {
                total: judicialDatabase.interpretations.length,
                metadata: judicialDatabase.metadata.interpretations
            },
            courtCases: {
                total: judicialDatabase.courtCases.length,
                metadata: judicialDatabase.metadata.courtCases
            },
            searchIndex: judicialDatabase.searchIndex.size,
            loadStatus: judicialDatabase.loadStatus
        }
    });
});

// Enhanced case search endpoint
app.get('/api/case', async (req, res) => {
    if (judicialDatabase.loadStatus === 'loading') {
        return res.status(503).json({
            error: 'Database is still loading, please try again in a moment'
        });
    }

    if (judicialDatabase.loadStatus === 'failed') {
        return res.status(500).json({
            error: 'Database failed to load'
        });
    }

    const { year, caseType, number, query } = req.query;

    // Handle constitutional interpretations (釋字)
    if (caseType === '釋字' || (query && query.includes('釋字'))) {
        const interpNumber = number || (query && query.match(/釋字第?(\d+)號?/)?.[1]);

        if (!interpNumber) {
            return res.status(400).json({
                error: 'Missing interpretation number for constitutional interpretation search'
            });
        }

        const interpretation = judicialDatabase.interpretations.find(
            item => item.number === parseInt(interpNumber)
        );

        if (interpretation) {
            return res.json({
                success: true,
                source: 'processed_interpretations_database',
                data: interpretation,
                caseNumber: `釋字第${interpNumber}號`,
                urls: {
                    view: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${interpretation.fileSetId}`,
                    download: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${interpretation.fileSetId}`
                }
            });
        }

        return res.status(404).json({
            error: `Constitutional interpretation '釋字第${interpNumber}號' not found`,
            availableInterpretations: judicialDatabase.interpretations.length,
            suggestion: 'Try searching with a different interpretation number'
        });
    }

    // Handle general case search
    if (!year || !caseType || !number) {
        return res.status(400).json({
            error: 'Missing required query parameters: year, caseType, number'
        });
    }

    // Search in database
    const searchKey = `${year}-${caseType}-${number}`.toLowerCase();
    const searchResult = judicialDatabase.searchIndex.get(searchKey);

    if (searchResult && searchResult.type === 'case') {
        const foundCase = judicialDatabase.courtCases[searchResult.index];
        return res.json({
            success: true,
            source: judicialDatabase.loadStatus === 'loaded' ? 'processed_database' : 'legacy_database',
            data: foundCase,
            caseNumber: `${year}年度${caseType}字第${number}號`
        });
    }

    return res.status(404).json({
        error: `Case '${year}年度${caseType}字第${number}號' not found`,
        searchedKey: searchKey,
        databaseSize: judicialDatabase.courtCases.length
    });
});

// Search interpretations endpoint
app.get('/api/search/interpretations', (req, res) => {
    const { q, limit = 20 } = req.query;

    let results = judicialDatabase.interpretations;

    if (q && q.trim()) {
        const searchTerm = q.toLowerCase().trim();
        results = judicialDatabase.interpretations.filter(item =>
            item.title.toLowerCase().includes(searchTerm) ||
            item.number.toString().includes(searchTerm)
        );
    }

    results = results.slice(0, parseInt(limit));

    res.json({
        success: true,
        results: results,
        total: results.length,
        query: q
    });
});

// --- 4. START SERVER ---

// Start server
async function startServer() {
    console.log('[Server] 🚀 Starting CiteRight Legal Server...');

    // Load databases first
    const dbLoaded = await loadJudicialDatabase();
    if (!dbLoaded) {
        console.warn('[Server] ⚠️ Server starting without complete database');
    }

    app.listen(PORT, () => {
        console.log(`[Server] ✅ Server running on http://localhost:${PORT}`);
        console.log(`[Server] 📊 Database status: ${judicialDatabase.loadStatus}`);
        console.log(`[Server] 📚 Interpretations: ${judicialDatabase.interpretations.length}`);
        console.log(`[Server] 📁 Court cases: ${judicialDatabase.courtCases.length}`);
        console.log('[Server] 🔗 Available endpoints:');
        console.log('  GET /health - Server health check');
        console.log('  GET /api/stats - Database statistics');
        console.log('  GET /api/case - Case lookup');
        console.log('  GET /api/search/interpretations - Search interpretations');
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('[Server] 🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[Server] 🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});

// Start the server
startServer().catch(error => {
    console.error('[Server] ❌ Failed to start server:', error);
    process.exit(1);
});
