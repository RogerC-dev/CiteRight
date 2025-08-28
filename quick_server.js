const express = require('express');
const cors = require('cors');
const fs = require('fs');

console.log('🚀 Starting CiteRight server...');

const app = express();
app.use(cors());
app.use(express.json());

let interpretations = [];

// Load data immediately
try {
    const data = fs.readFileSync('./processed_data/judicial_interpretations_full_db.json', 'utf8');
    const db = JSON.parse(data);
    interpretations = db.interpretations || [];
    console.log(`✅ Loaded ${interpretations.length} constitutional interpretations with full content`);
} catch (error) {
    console.error('❌ Failed to load interpretations, falling back to basic database:', error.message);
    try {
        const data = fs.readFileSync('./processed_data/judicial_interpretations_db.json', 'utf8');
        const db = JSON.parse(data);
        interpretations = db.interpretations || [];
        console.log(`⚠️ Using basic database with ${interpretations.length} interpretations`);
    } catch (fallbackError) {
        console.error('❌ Failed to load any database:', fallbackError.message);
    }
}

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            loadStatus: 'loaded',
            interpretations: interpretations.length
        }
    });
});

app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        statistics: {
            interpretations: {
                total: interpretations.length
            },
            loadStatus: 'loaded'
        }
    });
});

app.get('/api/case', (req, res) => {
    const { caseType, number } = req.query;
    
    console.log(`🔍 Request: ${caseType} ${number}`);
    
    if (caseType === '釋字' && number) {
        const requestedNumber = parseInt(number);
        const found = interpretations.find(item => item.number === requestedNumber);

        if (found) {
            console.log(`✅ Found: ${found.title}`);

            // Return comprehensive case data
            const response = {
                success: true,
                data: {
                    title: found.title,
                    number: found.number,
                    case_type: found.case_type || found.issue || '無資料',
                    case_number: found.case_number || found.title,
                    court: found.court || '司法院大法官',
                    date: found.date || '無資料',
                    issue: found.issue || '無資料',
                    description: found.description || '無資料',
                    reasoning: found.reasoning || '無資料',
                    facts: found.facts || '無資料',
                    constitutional_articles: found.constitutional_articles || [],
                    related_laws: found.related_laws || [],
                    english_title: found.english_title || '',
                    english_description: found.english_description || '',
                    data_url: found.data_url || '',
                    full_content: found.full_content || {},
                    extraction_status: found.extraction_status || 'unknown'
                },
                caseNumber: found.case_number || found.title,
                urls: {
                    view: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${found.fileSetId}`,
                    download: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${found.fileSetId}`,
                    official: found.data_url || ''
                }
            };

            return res.json(response);
        }
        
        // Find nearby interpretations to suggest
        const allNumbers = interpretations.map(item => item.number).sort((a, b) => a - b);
        const closeBefore = allNumbers.filter(n => n < requestedNumber).slice(-3);
        const closeAfter = allNumbers.filter(n => n > requestedNumber).slice(0, 3);
        const nearby = [...closeBefore, ...closeAfter];

        console.log(`❌ Not found: 釋字第${number}號. Nearby available: ${nearby.join(', ')}`);

        return res.status(404).json({
            error: `釋字第${number}號 not found in database`,
            message: `This interpretation is not available in our current database of ${interpretations.length} interpretations.`,
            available_nearby: nearby.length > 0 ? nearby.map(n => `釋字第${n}號`) : [],
            suggestion: nearby.length > 0 ? `Try 釋字第${nearby[0]}號 or other nearby interpretations` : 'No nearby interpretations available',
            database_range: {
                lowest: Math.min(...allNumbers),
                highest: Math.max(...allNumbers),
                total: interpretations.length
            }
        });
    }
    
    res.status(400).json({ error: 'Invalid parameters' });
});

const PORT = 3002;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`✅ Server running on http://localhost:${port}`);
        console.log(`📚 Ready to serve ${interpretations.length} interpretations`);
        console.log(`🔗 Test: http://localhost:${port}/api/case?caseType=釋字&number=712`);
        console.log(`🔗 Test missing: http://localhost:${port}/api/case?caseType=釋字&number=748`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${port} in use, trying ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('❌ Server error:', err);
        }
    });
}

startServer(PORT);
