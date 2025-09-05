const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/laws/search:
 *   get:
 *     summary: Search laws
 *     description: Search for laws by name (Chinese or English)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
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
 *                 query:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: number
 *       400:
 *         description: Invalid query
 *       500:
 *         description: Search error
 */
router.get('/search', asyncHandler(async (req, res) => {
    const { q: query, limit = 10 } = req.query;
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    if (!query || query.trim().length < 2) {
        throw new ApiError(400, 'Query must be at least 2 characters');
    }
    
    console.log(`🔍 Searching laws for: "${query}"`);
    
    const [rows] = await database.query(
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
}));

/**
 * @swagger
 * /api/laws/{id}:
 *   get:
 *     summary: Get law details
 *     description: Get detailed information about a specific law including its articles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Law ID
 *     responses:
 *       200:
 *         description: Law details with articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 law:
 *                   type: object
 *                 articles:
 *                   type: array
 *                   items:
 *                     type: object
 *                 articleCount:
 *                   type: number
 *       404:
 *         description: Law not found
 *       500:
 *         description: Server error
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    console.log(`🔍 Getting law details for ID: ${id}`);
    
    // Get law details
    const [lawRows] = await database.query(
        `SELECT * FROM laws WHERE id = ?`,
        [id]
    );
    
    if (lawRows.length === 0) {
        throw new ApiError(404, 'Law not found');
    }
    
    // Get articles for this law
    const [articleRows] = await database.query(
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
}));

module.exports = router;