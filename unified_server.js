const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Simple CORS setup
app.use(cors());
app.use(express.json());

// In-memory database
let database = {
    interpretations: [],
    loadStatus: 'loading'
};

// Load interpretations synchronously for reliability
function loadData() {
    try {
        console.log('🚀 Starting server and loading data...');
        
        // Load constitutional interpretations
        const interpretationsPath = './processed_data/judicial_interpretations_db.json';
        
        if (fs.existsSync(interpretationsPath)) {
            const data = fs.readFileSync(interpretationsPath, 'utf8');
            const parsed = JSON.parse(data);
            database.interpretations = parsed.interpretations || [];
            console.log(`✅ Loaded ${database.interpretations.length} constitutional interpretations`);
        } else {
            console.warn('⚠️ Interpretations database not found');
        }
        
        database.loadStatus = 'loaded';
        return true;
    } catch (error) {
        console.error('❌ Error loading data:', error.message);
        database.loadStatus = 'error';
        return false;
    }
}

// Load data immediately
loadData();

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        loadStatus: database.loadStatus,
        interpretations: database.interpretations.length
    });
});

// Main case lookup endpoint
app.get('/api/case', (req, res) => {
    const { caseType, number } = req.query;
    
    console.log(`🔍 API Request: caseType=${caseType}, number=${number}`);
    
    // Handle constitutional interpretations
    if (caseType === '釋字') {
        if (!number) {
            return res.status(400).json({ error: 'Missing number parameter' });
        }
        
        console.log(`🔍 Searching for interpretation: ${number}`);
        
        // Find the interpretation
        const interpretation = database.interpretations.find(
            item => item.number === parseInt(number)
        );
        
        if (interpretation) {
            console.log(`✅ Found interpretation ${number}: ${interpretation.title}`);
            
            return res.json({
                success: true,
                data: interpretation,
                caseNumber: `釋字第${number}號`,
                urls: {
                    view: `https://aomp.judicial.gov.tw/juds/FilePage.aspx?id=${interpretation.fileSetId}`,
                    download: `https://aomp.judicial.gov.tw/juds/Download.ashx?id=${interpretation.fileSetId}`
                }
            });
        } else {
            console.log(`❌ Interpretation ${number} not found`);
            
            // Show some available numbers for debugging
            const available = database.interpretations
                .slice(0, 5)
                .map(item => item.number)
                .join(', ');
            
            return res.status(404).json({
                error: `Constitutional interpretation '釋字第${number}號' not found`,
                totalAvailable: database.interpretations.length,
                sampleAvailable: available
            });
        }
    }
    
    return res.status(400).json({ error: 'Unsupported case type' });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const sample = database.interpretations.slice(0, 10).map(item => ({
        number: item.number,
        title: item.title
    }));
    
    res.json({
        loadStatus: database.loadStatus,
        total: database.interpretations.length,
        sample: sample
    });
});

// Start server with port detection
function startServer() {
    const ports = [3002, 3004, 3005, 3006];
    
    function tryPort(portIndex) {
        if (portIndex >= ports.length) {
            console.error('❌ All ports are in use');
            process.exit(1);
        }
        
        const port = ports[portIndex];
        
        const server = app.listen(port, () => {
            console.log(`✅ Server running on http://localhost:${port}`);
            console.log(`📚 Loaded ${database.interpretations.length} interpretations`);
            console.log(`📊 Status: ${database.loadStatus}`);
            console.log('🔗 Test endpoints:');
            console.log(`  http://localhost:${port}/health`);
            console.log(`  http://localhost:${port}/api/debug`);
            console.log(`  http://localhost:${port}/api/case?caseType=釋字&number=712`);
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Port ${port} in use, trying next...`);
                tryPort(portIndex + 1);
            } else {
                console.error('❌ Server error:', err.message);
                process.exit(1);
            }
        });
    }
    
    tryPort(0);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

// Start the server
startServer();
