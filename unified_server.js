const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();

// Simple CORS setup
app.use(cors());
app.use(express.json());

// Database configuration
const dbConfig = {
    host: '140.134.24.157',
    port: 23306,
    user: 'root',
    password: 'pbiecs123456',
    database: 'D1397218_LawExtension',
    charset: 'utf8mb4'
};

// Database connection pool
let db;

// Initialize database connection
async function initializeDatabase() {
    try {
        console.log('🚀 Connecting to MariaDB database...');
        db = await mysql.createConnection(dbConfig);
        
        // Test connection and get counts
        const [lawsResult] = await db.execute('SELECT COUNT(*) as count FROM laws');
        const [articlesResult] = await db.execute('SELECT COUNT(*) as count FROM articles');
        const [interpretationsResult] = await db.execute('SELECT COUNT(*) as count FROM interpretations');
        
        console.log(`✅ Connected to database successfully`);
        console.log(`📚 Available data:`);
        console.log(`  • ${lawsResult[0].count} laws`);
        console.log(`  • ${articlesResult[0].count} articles`);
        console.log(`  • ${interpretationsResult[0].count} constitutional interpretations`);
        
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database on startup
initializeDatabase();

// Health check
app.get('/health', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ status: 'Database not connected' });
        }
        
        const [lawsResult] = await db.execute('SELECT COUNT(*) as count FROM laws');
        const [articlesResult] = await db.execute('SELECT COUNT(*) as count FROM articles');
        const [interpretationsResult] = await db.execute('SELECT COUNT(*) as count FROM interpretations');
        
        res.json({
            status: 'ok',
            database: 'connected',
            data: {
                laws: lawsResult[0].count,
                articles: articlesResult[0].count,
                interpretations: interpretationsResult[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Main case lookup endpoint
app.get('/api/case', async (req, res) => {
    try {
        const { caseType, number } = req.query;
        
        console.log(`🔍 API Request: caseType=${caseType}, number=${number}`);
        
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        // Handle constitutional interpretations
        if (caseType === '釋字') {
            if (!number) {
                return res.status(400).json({ error: 'Missing number parameter' });
            }
            
            console.log(`🔍 Searching for interpretation: ${number}`);
            
            // Query database for interpretation
            const [rows] = await db.execute(
                `SELECT i.*, 
                        iz.issue, iz.description, iz.reasoning, iz.fact,
                        ie.issue as english_issue, ie.description as english_description, 
                        ie.reasoning as english_reasoning, ie.fact as english_fact
                 FROM interpretations i
                 LEFT JOIN interpretations_zh iz ON i.interpretation_number = iz.interpretation_number  
                 LEFT JOIN interpretations_en ie ON i.interpretation_number = ie.interpretation_number
                 WHERE i.interpretation_number = ?`,
                [number]
            );
            
            if (rows.length > 0) {
                const interpretation = rows[0];
                console.log(`✅ Found interpretation ${number}`);
                
                return res.json({
                    success: true,
                    data: {
                        number: interpretation.interpretation_number,
                        date: interpretation.interpretation_date,
                        url: interpretation.source_url,
                        chinese: {
                            issue: interpretation.issue,
                            description: interpretation.description,
                            reasoning: interpretation.reasoning,
                            fact: interpretation.fact
                        },
                        english: {
                            issue: interpretation.english_issue,
                            description: interpretation.english_description,
                            reasoning: interpretation.english_reasoning,
                            fact: interpretation.english_fact
                        }
                    },
                    caseNumber: `釋字第${number}號`
                });
            } else {
                console.log(`❌ Interpretation ${number} not found`);
                
                // Get sample available numbers
                const [sampleRows] = await db.execute(
                    'SELECT interpretation_number FROM interpretations ORDER BY interpretation_number LIMIT 5'
                );
                const available = sampleRows.map(row => row.interpretation_number).join(', ');
                
                return res.status(404).json({
                    error: `Constitutional interpretation '釋字第${number}號' not found`,
                    sampleAvailable: available
                });
            }
        }
        
        return res.status(400).json({ error: 'Unsupported case type. Currently supports: 釋字' });
    } catch (error) {
        console.error('❌ Database query error:', error);
        return res.status(500).json({ error: 'Database query failed', details: error.message });
    }
});

// Search laws endpoint
app.get('/api/laws/search', async (req, res) => {
    try {
        const { q: query, limit = 10 } = req.query;
        
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }
        
        console.log(`🔍 Searching laws for: "${query}"`);
        
        const [rows] = await db.execute(
            `SELECT id, law_name, english_law_name, law_category, law_nature
             FROM laws 
             WHERE law_name LIKE ? OR english_law_name LIKE ?
             ORDER BY 
                CASE 
                    WHEN law_name LIKE ? THEN 1 
                    WHEN law_name LIKE ? THEN 2
                    ELSE 3 
                END, law_name
             LIMIT ?`,
            [`%${query}%`, `%${query}%`, `${query}%`, `%${query}%`, parseInt(limit)]
        );
        
        console.log(`✅ Found ${rows.length} matching laws`);
        
        res.json({
            success: true,
            query: query,
            results: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('❌ Law search error:', error);
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

// Get law details with articles
app.get('/api/laws/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!db) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        console.log(`🔍 Getting law details for ID: ${id}`);
        
        // Get law details
        const [lawRows] = await db.execute(
            `SELECT * FROM laws WHERE id = ?`,
            [id]
        );
        
        if (lawRows.length === 0) {
            return res.status(404).json({ error: 'Law not found' });
        }
        
        // Get articles for this law
        const [articleRows] = await db.execute(
            `SELECT article_number, chapter_section, article_content, english_article_content
             FROM articles 
             WHERE law_id = ? 
             ORDER BY id`,
            [id]
        );
        
        console.log(`✅ Found law with ${articleRows.length} articles`);
        
        res.json({
            success: true,
            law: lawRows[0],
            articles: articleRows,
            articleCount: articleRows.length
        });
    } catch (error) {
        console.error('❌ Law details error:', error);
        res.status(500).json({ error: 'Failed to get law details', details: error.message });
    }
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ status: 'Database not connected' });
        }
        
        // Get sample data from each table
        const [sampleLaws] = await db.execute('SELECT id, law_name FROM laws LIMIT 5');
        const [sampleInterpretations] = await db.execute('SELECT interpretation_number FROM interpretations LIMIT 5');
        
        res.json({
            status: 'connected',
            sampleLaws: sampleLaws,
            sampleInterpretations: sampleInterpretations.map(row => row.interpretation_number)
        });
    } catch (error) {
        res.status(500).json({ error: 'Debug query failed', details: error.message });
    }
});

// Start server with port detection
function startServer() {
    const ports = [3000, 3002, 3004, 3005, 3006];
    
    function tryPort(portIndex) {
        if (portIndex >= ports.length) {
            console.error('❌ All ports are in use');
            process.exit(1);
        }
        
        const port = ports[portIndex];
        
        const server = app.listen(port, () => {
            console.log(`✅ Server running on http://localhost:${port}`);
            console.log('🔗 Available endpoints:');
            console.log(`  📊 Health: http://localhost:${port}/health`);
            console.log(`  🔍 Debug: http://localhost:${port}/api/debug`);
            console.log(`  ⚖️ Constitutional interpretation: http://localhost:${port}/api/case?caseType=釋字&number=712`);
            console.log(`  📖 Search laws: http://localhost:${port}/api/laws/search?q=民法`);
            console.log(`  📑 Law details: http://localhost:${port}/api/laws/1`);
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
