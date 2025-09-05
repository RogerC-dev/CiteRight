const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

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
        const [rows] = await database.query(
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
            const [sampleRows] = await database.query(
                'SELECT interpretation_number FROM interpretations ORDER BY interpretation_number LIMIT 5'
            );
            const available = sampleRows.map(row => row.interpretation_number).join(', ');
            
            throw new ApiError(404, `Constitutional interpretation '釋字第${number}號' not found`, true, JSON.stringify({ sampleAvailable: available }));
        }
    }
    
    throw new ApiError(400, 'Unsupported case type. Currently supports: 釋字');
}));

module.exports = router;