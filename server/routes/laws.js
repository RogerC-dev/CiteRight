const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/laws:
 *   get:
 *     summary: Get all laws names
 *     description: Retrieve a list of all laws names
 *     responses:
 *       200:
 *         description: A list of laws names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/', asyncHandler(async (req, res) => {
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    const [rows] = await database.query(`
        SELECT DISTINCT LawName FROM Law ORDER BY LawName
    `);
    res.json({
        success: true,
        data: rows.map(row => row.LawName)
    });
}));


/**
 * @swagger
 * /api/laws/{lawName}:
 *   get:
 *     summary: Get law details
 *     description: Get detailed information about a specific law including its metadata and an Articles array (each item has CaptionTitle, ArticleNo, Article)
 *     parameters:
 *       - in: path
 *         name: lawName
 *         required: true
 *         schema:
 *           type: string
 *         description: Law name (URL encoded)
 *     responses:
 *       200:
 *         description: Law details with captions and articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 LawLevel:
 *                   type: string
 *                 LawName:
 *                   type: string
 *                 LawUrl:
 *                   type: string
 *                   format: uri
 *                 LawCategory:
 *                   type: string
 *                 LawModifiedDate:
 *                   type: string
 *                   format: date-time
 *                   description: Last modified date
 *                 LawEffectiveDate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 LawEffectiveNote:
 *                   type: string
 *                 LawAbandonNote:
 *                   type: string
 *                 LawHistories:
 *                   type: string
 *                 LawHasEngVersion:
 *                   type: integer
 *                 EngLawName:
 *                   type: string
 *                 LawForeword:
 *                   type: string
 *                 CreatedAt:
 *                   type: string
 *                   format: date-time
 *                 UpdatedAt:
 *                   type: string
 *                   format: date-time
 *                 Articles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       CaptionTitle:
 *                         type: string
 *                       ArticleNo:
 *                         type: string
 *                       Article:
 *                         type: string
 *       404:
 *         description: Law not found
 *       500:
 *         description: Server error
 *       503:
 *         description: Database not connected
 */
router.get('/:lawName', asyncHandler(async (req, res) => {
    const { lawName } = req.params;

    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }

    console.log(`🔍 Getting law details for: ${decodeURIComponent(lawName)}`);

    // Get law details
    const [lawRows] = await database.query(
        `SELECT * FROM Law WHERE LawName = ?`,
        [decodeURIComponent(lawName)]
    );

    if (lawRows.length === 0) {
        throw new ApiError(404, 'Law not found');
    }

    // Get captions and articles for this law
    const [[articles]] = await database.query(
        `SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'CaptionTitle', c.CaptionTitle,
                    'ArticleNo', a.ArticleNo,
                    'Article', a.ArticleContent
                )
            ) AS Articles FROM LawArticle a
                    LEFT JOIN LawCaption c ON c.Id = a.CaptionId
                WHERE a.LawName = ?
            `,
        [decodeURIComponent(lawName)]
    );
    lawRows[0].Articles = JSON.parse(articles.Articles)
    lawRows[0].type = '法律';
    res.json(lawRows[0]);
}));


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
 *         description: Law level (e.g., "憲法", "法律", "命令")
 *       - in: path
 *         name: lawName
 *         required: true
 *         schema:
 *           type: string
 *         description: Law name (URL encoded)
 *     responses:
 *       200:
 *         description: Law details with captions and articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 law:
 *                   type: object
 *                 captions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 captionCount:
 *                   type: number
 *       404:
 *         description: Law not found
 *       500:
 *         description: Server error
 */
router.get('/:lawLevel/:lawName', asyncHandler(async (req, res) => {
    const { lawLevel, lawName } = req.params;
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    console.log(`🔍 Getting law details for: ${lawLevel} - ${decodeURIComponent(lawName)}`);
    
    // Get law details
    const [lawRows] = await database.query(
        `SELECT * FROM Law WHERE LawLevel = ? AND LawName = ?`,
        [lawLevel, decodeURIComponent(lawName)]
    );
    
    if (lawRows.length === 0) {
        throw new ApiError(404, 'Law not found');
    }
    
    // Get captions and articles for this law
    const [[articles]] = await database.query(
        `SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'CaptionTitle', c.CaptionTitle,
                    'ArticleNo', a.ArticleNo,
                    'Article', a.ArticleContent
                ) 
            ) AS Articles FROM LawArticle a 
                    LEFT JOIN LawCaption c ON c.Id = a.CaptionId
                WHERE a.LawLevel = ? 
                  AND a.LawName = ?
            `,
        [lawLevel, decodeURIComponent(lawName)]
    );
    lawRows[0].Articles = JSON.parse(articles.Articles)
    lawRows[0].type = '法條';
    res.json(lawRows[0]);
}));


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
        `SELECT LawLevel, LawName, EngLawName, LawCategory, LawURL
         FROM Law 
         WHERE LawName LIKE ? OR EngLawName LIKE ?
         ORDER BY 
            CASE 
                WHEN LawName LIKE ? THEN 1 
                WHEN LawName LIKE ? THEN 2
                ELSE 3 
            END, LawName
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
 * /api/laws/{lawLevel}/{lawName}:
 *   get:
 *     summary: Get law details
 *     description: Get detailed information about a specific law including its captions and articles
 *     parameters:
 *       - in: path
 *         name: lawLevel
 *         required: true
 *         schema:
 *           type: string
 *         description: Law level (e.g., "法律", "命令")
 *       - in: path
 *         name: lawName
 *         required: true
 *         schema:
 *           type: string
 *         description: Law name (URL encoded)
 *     responses:
 *       200:
 *         description: Law details with captions and articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 law:
 *                   type: object
 *                 captions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 captionCount:
 *                   type: number
 *       404:
 *         description: Law not found
 *       500:
 *         description: Server error
 */
router.get('/:lawLevel/:lawName', asyncHandler(async (req, res) => {
    const { lawLevel, lawName } = req.params;
    
    if (!database.isConnected()) {
        throw new ApiError(503, 'Database not connected');
    }
    
    console.log(`🔍 Getting law details for: ${lawLevel} - ${decodeURIComponent(lawName)}`);
    
    // Get law details
    const [lawRows] = await database.query(
        `SELECT * FROM Law WHERE LawLevel = ? AND LawName = ?`,
        [lawLevel, decodeURIComponent(lawName)]
    );
    
    if (lawRows.length === 0) {
        throw new ApiError(404, 'Law not found');
    }
    
    // Get captions and articles for this law
    const [[articles]] = await database.query(
        `SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'CaptionTitle', c.CaptionTitle,
                    'ArticleNo', a.ArticleNo,
                    'Article', a.ArticleContent
                ) 
            ) AS Articles FROM LawArticle a 
                    LEFT JOIN LawCaption c ON c.Id = a.CaptionId
                WHERE a.LawLevel = ? 
                  AND a.LawName = ?
            `,
        [lawLevel, decodeURIComponent(lawName)]
    );
    lawRows[0].Articles = JSON.parse(articles.Articles)
    res.json(lawRows[0]);
}));

module.exports = router;