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
    
    // Get sample data from each table
    const [sampleLaws] = await database.query('SELECT id, law_name FROM laws LIMIT 5');
    const [sampleInterpretations] = await database.query('SELECT interpretation_number FROM interpretations LIMIT 5');
    
    res.json({
        status: 'connected',
        sampleLaws: sampleLaws,
        sampleInterpretations: sampleInterpretations.map(row => row.interpretation_number)
    });
}));

module.exports = router;