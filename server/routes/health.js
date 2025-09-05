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
    
    const [lawsResult] = await database.query('SELECT COUNT(*) as count FROM laws');
    const [articlesResult] = await database.query('SELECT COUNT(*) as count FROM articles');
    const [interpretationsResult] = await database.query('SELECT COUNT(*) as count FROM interpretations');
    
    res.json({
        status: 'ok',
        database: 'connected',
        data: {
            laws: lawsResult[0].count,
            articles: articlesResult[0].count,
            interpretations: interpretationsResult[0].count
        }
    });
}));

module.exports = router;