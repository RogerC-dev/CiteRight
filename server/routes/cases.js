const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { type } = require('jquery');

/**
 * @swagger
 * /api/case:
 *   get:
 *     summary: Look up constitutional interpretation
 *     description: Get constitutional interpretation details by case type and number
 *     parameters:
 *       - in: query
 *         name: caseType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [釋字]
 *         description: Type of case (currently only supports 釋字)
 *       - in: query
 *         name: number
 *         required: true
 *         schema:
 *           type: string
 *         description: Constitutional interpretation number
 *     responses:
 *       200:
 *         description: Constitutional interpretation found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 caseNumber:
 *                   type: string
 *       400:
 *         description: Bad request or unsupported case type
 *       404:
 *         description: Case not found
 *       500:
 *         description: Database error
 */
router.get('/', asyncHandler(async (req, res) => {
    const { caseType, number } = req.query;
    
    console.log(`🔍 API Request: caseType=${caseType}, number=${number}`);
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    // Handle constitutional interpretations
    if (caseType === '釋字') {
        if (!number) {
            throw new ApiError(400, 'Missing number parameter');
        }
        
        console.log(`🔍 Searching for interpretation: ${number}`);
        
        // Query database for interpretation
        const result = await database.query(
            `SELECT i.*,
                    iz.issue, iz.description, iz.reasoning, iz.fact,
                    ie.issue as english_issue, ie.description as english_description,
                    ie.reasoning as english_reasoning, ie.fact as english_fact
             FROM interpretations i
             LEFT JOIN interpretations_zh iz ON i.interpretation_number = iz.interpretation_number
             LEFT JOIN interpretations_en ie ON i.interpretation_number = ie.interpretation_number
             WHERE i.interpretation_number = @param0`,
            [number]
        );
        const rows = result.recordset;
        
        if (rows.length > 0) {
            const interpretation = rows[0];
            console.log(`✅ Found interpretation ${number}`);
            
            return res.json({
                type: '釋字',
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
            });
        } else {
            console.log(`❌ Interpretation ${number} not found`);

            // Get sample available numbers
            const sampleResult = await database.query(
                'SELECT TOP 5 interpretation_number FROM interpretations ORDER BY interpretation_number'
            );
            const available = sampleResult.recordset.map(row => row.interpretation_number).join(', ');
            
            throw new ApiError(404, `Constitutional interpretation '釋字第${number}號' not found`, true, JSON.stringify({ sampleAvailable: available }));
        }
    }
    
    throw new ApiError(400, 'Unsupported case type. Currently supports: 釋字');
}));

/**
 * @swagger
 * /api/case/search:
 *   get:
 *     summary: Search constitutional interpretations
 *     description: Search for constitutional interpretations by query
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           default: interpretation
 *         description: Search type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: array
 *                 total:
 *                   type: integer
 */
router.get('/search', asyncHandler(async (req, res) => {
    const { q, type = 'interpretation', limit = 20 } = req.query;
    
    console.log(`🔍 Search request: q=${q}, type=${type}, limit=${limit}`);
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    if (!q || q.trim() === '') {
        throw new ApiError(400, 'Missing search query parameter');
    }
    
    const searchTerm = `%${q.trim()}%`;
    const limitNum = parseInt(limit) || 20;
    
    // Search interpretations
    if (type === 'interpretation') {
        const result = await database.query(
            `SELECT TOP (@param4) i.interpretation_number, i.interpretation_date, i.source_url,
                    iz.number_title, iz.issue, iz.description
             FROM interpretations i
             LEFT JOIN interpretations_zh iz ON i.interpretation_number = iz.interpretation_number
             WHERE i.interpretation_number LIKE @param0
                OR iz.number_title LIKE @param1
                OR iz.issue LIKE @param2
                OR iz.description LIKE @param3
             ORDER BY i.interpretation_number DESC`,
            [searchTerm, searchTerm, searchTerm, searchTerm, limitNum]
        );
        const rows = result.recordset;
        
        const results = rows.map(row => ({
            number: row.interpretation_number,
            title: row.number_title,
            date: row.interpretation_date,
            url: row.source_url,
            issue: row.issue,
            description: row.description ? row.description.substring(0, 200) + '...' : null
        }));
        
        console.log(`✅ Found ${results.length} search results`);
        
        return res.json({
            results: results,
            total: results.length,
            query: q
        });
    }
    
    throw new ApiError(400, 'Unsupported search type');
}));

/**
 * @swagger
 * /api/case/recent:
 *   get:
 *     summary: Get recent constitutional interpretations
 *     description: Get the most recent constitutional interpretations
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Recent interpretations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: array
 *                 total:
 *                   type: integer
 */
router.get('/recent', asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query;
    
    console.log(`🔍 Recent cases request: limit=${limit}`);
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    const limitNum = parseInt(limit) || 20;

    const result = await database.query(
        `SELECT TOP (@param0) i.interpretation_number, i.interpretation_date, i.source_url,
                iz.number_title, iz.issue, iz.description
         FROM interpretations i
         LEFT JOIN interpretations_zh iz ON i.interpretation_number = iz.interpretation_number
         ORDER BY i.interpretation_number DESC`,
        [limitNum]
    );
    const rows = result.recordset;
    
    const results = rows.map(row => ({
        number: row.interpretation_number,
        title: row.number_title,
        date: row.interpretation_date,
        url: row.source_url,
        issue: row.issue,
        description: row.description ? row.description.substring(0, 200) + '...' : null
    }));
    
    console.log(`✅ Found ${results.length} recent cases`);
    
    return res.json({
        success: true,
        results: results,
        total: results.length
    });
}));

module.exports = router;