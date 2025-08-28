const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Enhanced server configuration
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Comprehensive in-memory database
let judicialData = {
    interpretations: [],
    courtCases: [],
    searchIndex: new Map(),
    loadStatus: 'loading',
    stats: {
        interpretationsLoaded: 0,
        courtCasesLoaded: 0,
        extractedDataProcessed: 0
    }
};

// Load constitutional interpretations
async function loadInterpretations() {
    try {
        console.log('📚 Loading constitutional interpretations...');

        const interpretationsPath = './processed_data/judicial_interpretations_db.json';
        const interpretationsData = await fs.readFile(interpretationsPath, 'utf8');
        const interpretationsDB = JSON.parse(interpretationsData);

        judicialData.interpretations = interpretationsDB.interpretations || [];
        judicialData.stats.interpretationsLoaded = judicialData.interpretations.length;

        // Build search index for interpretations
        judicialData.interpretations.forEach((interpretation, index) => {
            const key = interpretation.number.toString();
            judicialData.searchIndex.set(`釋字-${key}`, {
                type: 'interpretation',
                data: interpretation,
                index
            });
        });

        console.log(`✅ Loaded ${judicialData.interpretations.length} constitutional interpretations`);
        return true;
    } catch (error) {
        console.warn('⚠️ Could not load interpretations:', error.message);
        return false;
    }
}

// Load court cases from various sources
async function loadCourtCases() {
    try {
        console.log('📁 Loading court cases from multiple sources...');

        // Load from main JSON files
        const jsonFiles = [
            'judicial_cases_database.json',
            'judgments_db.json',
            'judicial_cases_112.json',
            'judicial_cases_113.json',
            'judicial_cases_114.json'
        ];

        let totalLoaded = 0;

        for (const filename of jsonFiles) {
            try {
                const filePath = `./${filename}`;
                const data = await fs.readFile(filePath, 'utf8');
                const parsed = JSON.parse(data);

                let cases = [];
                if (Array.isArray(parsed)) {
                    cases = parsed;
                } else if (parsed.cases && Array.isArray(parsed.cases)) {
                    cases = parsed.cases;
                } else if (typeof parsed === 'object') {
                    cases = Object.values(parsed);
                }

                cases.forEach((caseData, index) => {
                    if (caseData && caseData.JYEAR && caseData.JCASE && caseData.JNO) {
                        judicialData.courtCases.push(caseData);

                        // Build search index
                        const searchKey = `${caseData.JYEAR}-${caseData.JCASE}-${caseData.JNO}`;
                        judicialData.searchIndex.set(searchKey.toLowerCase(), {
                            type: 'case',
                            data: caseData,
                            source: filename
                        });
                        totalLoaded++;
                    }
                });

                console.log(`  📄 Loaded ${cases.length} cases from ${filename}`);
            } catch (error) {
                console.warn(`  ⚠️ Could not load ${filename}:`, error.message);
            }
        }

        judicialData.stats.courtCasesLoaded = totalLoaded;
        console.log(`✅ Total court cases loaded: ${totalLoaded}`);
        return true;
    } catch (error) {
        console.warn('⚠️ Error loading court cases:', error.message);
        return false;
    }
}

// Process extracted data folders
async function processExtractedData() {
    try {
        console.log('📂 Processing extracted data folders...');

        const extractedDir = './extracted_data';
        const folders = await fs.readdir(extractedDir);

        let processedCount = 0;

        for (const folder of folders) {
            try {
                const folderPath = path.join(extractedDir, folder);
                const stat = await fs.stat(folderPath);

                if (stat.isDirectory()) {
                    // Look for CSV or TXT files in the folder
                    const subFolders = await fs.readdir(folderPath);

                    for (const subItem of subFolders) {
                        const subPath = path.join(folderPath, subItem);
                        const subStat = await fs.stat(subPath);

                        if (subStat.isDirectory()) {
                            // Process files in subfolder
                            const files = await fs.readdir(subPath);

                            for (const file of files) {
                                if (file.endsWith('.csv') || file.endsWith('.txt')) {
                                    processedCount++;
                                    // Store reference to extracted data
                                    const period = folder.match(/(\d{3})年(\d{1,2})月/);
                                    if (period) {
                                        const [, year, month] = period;
                                        const key = `extracted-${year}-${month}`;
                                        judicialData.searchIndex.set(key, {
                                            type: 'extracted',
                                            folder: folder,
                                            file: file,
                                            path: path.join(subPath, file)
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`  ⚠️ Could not process folder ${folder}:`, error.message);
            }
        }

        judicialData.stats.extractedDataProcessed = processedCount;
        console.log(`✅ Processed ${processedCount} extracted data files`);
        return true;
    } catch (error) {
        console.warn('⚠️ Error processing extracted data:', error.message);
        return false;
    }
}

// Load all databases
async function loadAllData() {
    console.log('🚀 Loading all judicial data...');

    await Promise.all([
        loadInterpretations(),
        loadCourtCases(),
        processExtractedData()
    ]);

    judicialData.loadStatus = 'loaded';

    console.log('✅ All data loaded successfully!');
    console.log(`📊 Final Stats:
  - Constitutional Interpretations: ${judicialData.stats.interpretationsLoaded}
  - Court Cases: ${judicialData.stats.courtCasesLoaded}
  - Extracted Data Files: ${judicialData.stats.extractedDataProcessed}
  - Total Search Index Entries: ${judicialData.searchIndex.size}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            loadStatus: judicialData.loadStatus,
            stats: judicialData.stats,
            searchIndexSize: judicialData.searchIndex.size
        }
    });
});

// Enhanced case search endpoint
app.get('/api/case', (req, res) => {
    if (judicialData.loadStatus === 'loading') {
        return res.status(503).json({
            error: 'Database is still loading, please try again in a moment'
        });
    }

    const { year, caseType, number, query } = req.query;

    console.log(`🔍 Search request: caseType=${caseType}, number=${number}, query=${query}`);

    // Handle constitutional interpretations (釋字)
    if (caseType === '釋字' || (query && query.includes('釋字'))) {
        const interpNumber = number || (query && query.match(/釋字第?(\d+)號?/)?.[1]);

        if (!interpNumber) {
            return res.status(400).json({
                error: 'Missing interpretation number'
            });
        }

        console.log(`🔍 Looking for interpretation: ${interpNumber}`);

        // Search in interpretations index
        const searchResult = judicialData.searchIndex.get(`釋字-${interpNumber}`);

        if (searchResult && searchResult.type === 'interpretation') {
            console.log(`✅ Found interpretation ${interpNumber} in database`);

            return res.json({
                success: true,
                source: 'processed_database',
                data: searchResult.data,
                caseNumber: `釋字第${interpNumber}號`,
                urls: {
                    view: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${searchResult.data.fileSetId}`,
                    download: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${searchResult.data.fileSetId}`
                }
            });
        }

        console.log(`❌ Interpretation ${interpNumber} not found in database`);
        console.log(`Available interpretations: ${judicialData.stats.interpretationsLoaded}`);

        // List some available interpretations for debugging
        const availableNumbers = Array.from(judicialData.searchIndex.keys())
            .filter(key => key.startsWith('釋字-'))
            .slice(0, 10)
            .map(key => key.replace('釋字-', ''));

        return res.status(404).json({
            error: `Constitutional interpretation '釋字第${interpNumber}號' not found`,
            availableInterpretations: judicialData.stats.interpretationsLoaded,
            sampleAvailableNumbers: availableNumbers,
            searchedKey: `釋字-${interpNumber}`
        });
    }

    // Handle general court cases
    if (year && caseType && number) {
        const searchKey = `${year}-${caseType}-${number}`.toLowerCase();
        console.log(`🔍 Looking for court case: ${searchKey}`);

        const searchResult = judicialData.searchIndex.get(searchKey);

        if (searchResult && searchResult.type === 'case') {
            console.log(`✅ Found court case ${searchKey}`);

            return res.json({
                success: true,
                source: searchResult.source || 'court_database',
                data: searchResult.data,
                caseNumber: `${year}年度${caseType}字第${number}號`
            });
        }

        console.log(`❌ Court case ${searchKey} not found`);

        return res.status(404).json({
            error: `Court case '${year}年度${caseType}字第${number}號' not found`,
            availableCourtCases: judicialData.stats.courtCasesLoaded,
            searchedKey: searchKey
        });
    }

    return res.status(400).json({
        error: 'Invalid request parameters',
        received: { year, caseType, number, query }
    });
});

// Statistics endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        statistics: {
            interpretations: {
                total: judicialData.interpretations.length
            },
            loadStatus: judicialData.loadStatus
        }
    });
});

// Search interpretations endpoint
app.get('/api/search/interpretations', (req, res) => {
    const { q, limit = 20 } = req.query;

    let results = judicialData.interpretations;

    if (q && q.trim()) {
        const searchTerm = q.toLowerCase().trim();
        results = judicialData.interpretations.filter(item =>
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

// Search court cases endpoint
app.get('/api/search/cases', (req, res) => {
    const { q, limit = 20 } = req.query;

    let results = [];

    if (q && q.trim()) {
        const searchTerm = q.toLowerCase().trim();

        // Search through court cases
        results = judicialData.courtCases.filter(caseData => {
            const caseNumber = `${caseData.JYEAR}年度${caseData.JCASE}字第${caseData.JNO}號`;
            return caseNumber.includes(searchTerm) ||
                   (caseData.JTITLE && caseData.JTITLE.includes(searchTerm)) ||
                   (caseData.JCOURT && caseData.JCOURT.includes(searchTerm));
        }).slice(0, parseInt(limit));
    }

    res.json({
        success: true,
        results: results,
        total: results.length,
        query: q
    });
});

// Debug endpoint to check available interpretations
app.get('/api/debug/interpretations', (req, res) => {
    const sample = judicialData.interpretations.slice(0, 10).map(item => ({
        number: item.number,
        title: item.title,
        fileSetId: item.fileSetId
    }));

    res.json({
        total: judicialData.interpretations.length,
        sample: sample,
        searchIndexKeys: Array.from(judicialData.searchIndex.keys())
            .filter(key => key.startsWith('釋字-'))
            .slice(0, 10)
    });
});

// Find available port and start server
async function startServer() {
    console.log('🚀 Starting CiteRight Legal Server...');

    // Load all databases
    await loadAllData();

    // Try different ports
    const ports = [3002, 3004, 3005, 3006, 3007];

    for (const port of ports) {
        try {
            await new Promise((resolve, reject) => {
                const server = app.listen(port, () => {
                    console.log(`✅ Server running on http://localhost:${port}`);
                    console.log(`📊 Database status: ${judicialData.loadStatus}`);
                    console.log(`📚 Interpretations: ${judicialData.stats.interpretationsLoaded}`);
                    console.log(`📁 Court Cases: ${judicialData.stats.courtCasesLoaded}`);
                    console.log(`📂 Extracted Files: ${judicialData.stats.extractedDataProcessed}`);
                    console.log('🔗 Available endpoints:');
                    console.log(`  GET http://localhost:${port}/health`);
                    console.log(`  GET http://localhost:${port}/api/stats`);
                    console.log(`  GET http://localhost:${port}/api/case`);
                    console.log(`  GET http://localhost:${port}/api/search/interpretations`);
                    console.log(`  GET http://localhost:${port}/api/search/cases`);
                    console.log(`  GET http://localhost:${port}/api/debug/interpretations`);
                    resolve(server);
                });

                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.log(`⚠️ Port ${port} is in use, trying next port...`);
                        reject(err);
                    } else {
                        reject(err);
                    }
                });
            });
            break; // Successfully started
        } catch (error) {
            if (port === ports[ports.length - 1]) {
                throw new Error('All ports are in use');
            }
            continue; // Try next port
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer().catch(error => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});
