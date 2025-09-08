const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/debug:
 *   get:
 *     summary: Debug information
 *     description: Get sample data from the database for debugging purposes
 *     responses:
 *       200:
 *         description: Debug information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 sampleLaws:
 *                   type: array
 *                   items:
 *                     type: object
 *                 sampleInterpretations:
 *                   type: array
 *                   items:
 *                     type: string
 *       503:
 *         description: Database not connected
 *       500:
 *         description: Debug query failed
 */
router.get('/', asyncHandler(async (req, res) => {
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    // Get comprehensive database statistics using correct table names
    const [lawCount] = await database.query('SELECT COUNT(*) as total FROM Law');
    const [articleCount] = await database.query('SELECT COUNT(*) as total FROM LawArticle');
    const [captionCount] = await database.query('SELECT COUNT(*) as total FROM LawCaption');

    // Get sample data
    const [sampleLaws] = await database.query('SELECT id, law_name, law_level FROM Law LIMIT 5');
    const [sampleArticles] = await database.query('SELECT article_number, article_content FROM LawArticle LIMIT 3');

    // Check if JudicialCase table exists
    let casesCount = 0;
    let sampleCases = [];
    try {
        const [caseCountResult] = await database.query('SELECT COUNT(*) as total FROM JudicialCase');
        casesCount = caseCountResult[0].total;
        if (casesCount > 0) {
            const [sampleCasesResult] = await database.query('SELECT case_number, case_type, court_name FROM JudicialCase LIMIT 3');
            sampleCases = sampleCasesResult;
        }
    } catch (error) {
        console.log('JudicialCase table not found');
    }

    res.json({
        status: 'connected',
        database: { connected: true },
        statistics: {
            laws: lawCount[0].total,
            articles: articleCount[0].total,
            captions: captionCount[0].total,
            cases: casesCount
        },
        sampleData: {
            laws: sampleLaws,
            articles: sampleArticles.map(row => ({
                number: row.article_number,
                content: row.article_content.substring(0, 100) + '...'
            })),
            cases: sampleCases
        },
        lastChecked: new Date().toISOString()
    });
}));

module.exports = router;