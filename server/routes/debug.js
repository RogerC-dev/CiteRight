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
    
    // Get comprehensive database statistics
    const [interpretationCount] = await database.query('SELECT COUNT(*) as total FROM interpretations');
    const [interpretationZhCount] = await database.query('SELECT COUNT(*) as total FROM interpretations_zh');
    const [interpretationEnCount] = await database.query('SELECT COUNT(*) as total FROM interpretations_en');
    const [additionsCount] = await database.query('SELECT COUNT(*) as total FROM interpretation_additions');
    const [sampleLaws] = await database.query('SELECT id, law_name FROM laws LIMIT 5');
    const [sampleInterpretations] = await database.query('SELECT interpretation_number FROM interpretations ORDER BY interpretation_number DESC LIMIT 5');
    
    res.json({
        status: 'connected',
        database: { connected: true },
        interpretations: {
            total: interpretationCount[0].total,
            available: interpretationCount[0].total,
            chinese_content: interpretationZhCount[0].total,
            english_content: interpretationEnCount[0].total,
            additions: additionsCount[0].total
        },
        sampleLaws: sampleLaws,
        sampleInterpretations: sampleInterpretations.map(row => row.interpretation_number),
        lastChecked: new Date().toISOString()
    });
}));

module.exports = router;