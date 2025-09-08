const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check database connection status and data counts
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 database:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     laws:
 *                       type: number
 *                     articles:
 *                       type: number
 *                     interpretations:
 *                       type: number
 *       503:
 *         description: Database not connected
 *       500:
 *         description: Server error
 */
router.get('/', asyncHandler(async (req, res) => {
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    const [lawsResult] = await database.query('SELECT COUNT(*) as count FROM Law');
    const [articlesResult] = await database.query('SELECT COUNT(*) as count FROM LawArticle');
    const [captionsResult] = await database.query('SELECT COUNT(*) as count FROM LawCaption');

    // Check if JudicialCase table exists for interpretations/cases
    let casesCount = 0;
    try {
        const [casesResult] = await database.query('SELECT COUNT(*) as count FROM JudicialCase');
        casesCount = casesResult[0].count;
    } catch (error) {
        // JudicialCase table might not exist yet, which is okay
        console.log('JudicialCase table not found, setting cases count to 0');
    }

    res.json({
        status: 'ok',
        database: 'connected',
        data: {
            laws: lawsResult[0].count,
            articles: articlesResult[0].count,
            captions: captionsResult[0].count,
            cases: casesCount
        }
    });
}));

module.exports = router;