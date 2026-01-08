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
    const lawCount = await database.query('SELECT COUNT(*) as total FROM Law');
    const articleCount = await database.query('SELECT COUNT(*) as total FROM LawArticle');
    const captionCount = await database.query('SELECT COUNT(*) as total FROM LawCaption');

    // Get sample data - SQL Server uses TOP instead of LIMIT
    const sampleLaws = await database.query('SELECT TOP 5 Id, LawName, LawLevel FROM Law');
    const sampleArticles = await database.query('SELECT TOP 3 ArticleNo, ArticleContent FROM LawArticle');

    // Check if JudicialCase table exists
    let casesCount = 0;
    let sampleCases = [];
    try {
        const caseCountResult = await database.query('SELECT COUNT(*) as total FROM JudicialCase');
        casesCount = caseCountResult.recordset[0].total;
        if (casesCount > 0) {
            const sampleCasesResult = await database.query('SELECT TOP 3 case_number, case_type, court_name FROM JudicialCase');
            sampleCases = sampleCasesResult.recordset;
        }
    } catch (error) {
        // JudicialCase table might not exist yet
    }

    res.json({
        status: 'connected',
        database: { connected: true },
        statistics: {
            laws: lawCount.recordset[0].total,
            articles: articleCount.recordset[0].total,
            captions: captionCount.recordset[0].total,
            cases: casesCount
        },
        sampleData: {
            laws: sampleLaws.recordset,
            articles: sampleArticles.recordset.map(row => ({
                number: row.ArticleNo,
                content: row.ArticleContent ? row.ArticleContent.substring(0, 100) + '...' : ''
            })),
            cases: sampleCases
        },
        lastChecked: new Date().toISOString()
    });
}));

module.exports = router;