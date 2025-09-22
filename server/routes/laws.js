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
    const result = await database.query(`
        SELECT DISTINCT LawName FROM Law ORDER BY LawName
    `);
    console.log(result);
    res.json({
        success: true,
        data: result.recordset.map(row => row.LawName)
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
    const lawResult = await database.query(
        `SELECT * FROM Law WHERE LawName = @param0`,
        [decodeURIComponent(lawName)]
    );

    if (lawResult.recordset.length === 0) {
        throw new ApiError(404, 'Law not found');
    }

    // Get captions and articles for this law
    const articlesResult = await database.query(
        `SELECT
            c.CaptionTitle,
            a.ArticleNo,
            a.ArticleContent as Article
         FROM LawArticle a
         LEFT JOIN LawCaption c ON c.Id = a.CaptionId
         WHERE a.LawName = @param0
         ORDER BY a.ArticleNo`,
        [decodeURIComponent(lawName)]
    );

    const law = lawResult.recordset[0];
    law.Articles = articlesResult.recordset;
    law.type = '法律';
    res.json(law);
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
    const lawResult = await database.query(
        `SELECT * FROM Law WHERE LawLevel = @param0 AND LawName = @param1`,
        [lawLevel, decodeURIComponent(lawName)]
    );

    if (lawResult.recordset.length === 0) {
        throw new ApiError(404, 'Law not found');
    }

    // Get captions and articles for this law
    const articlesResult = await database.query(
        `SELECT
            c.CaptionTitle,
            a.ArticleNo,
            a.ArticleContent as Article
         FROM LawArticle a
         LEFT JOIN LawCaption c ON c.Id = a.CaptionId
         WHERE a.LawLevel = @param0
           AND a.LawName = @param1
         ORDER BY a.ArticleNo`,
        [lawLevel, decodeURIComponent(lawName)]
    );

    const law = lawResult.recordset[0];
    law.Articles = articlesResult.recordset;
    law.type = '法條';
    res.json(law);
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
    
    const result = await database.query(
        `SELECT TOP (@param4) LawLevel, LawName, EngLawName, LawCategory, LawURL
         FROM Law
         WHERE LawName LIKE @param0 OR EngLawName LIKE @param1
         ORDER BY
            CASE
                WHEN LawName LIKE @param2 THEN 1
                WHEN LawName LIKE @param3 THEN 2
                ELSE 3
            END, LawName`,
        [`%${query}%`, `%${query}%`, `${query}%`, `%${query}%`, parseInt(limit)]
    );

    console.log(`✅ Found ${result.recordset.length} matching laws`);

    res.json({
        success: true,
        query: query,
        results: result.recordset,
        total: result.recordset.length
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
    const [lawResult] = await database.query(
        `SELECT * FROM Law WHERE LawLevel = @param0 AND LawName = @param1`,
        [lawLevel, decodeURIComponent(lawName)]
    );

    if (lawResult.recordset.length === 0) {
        throw new ApiError(404, 'Law not found');
    }

    // Get captions and articles for this law
    const articlesResult = await database.query(
        `SELECT
            c.CaptionTitle,
            a.ArticleNo,
            a.ArticleContent as Article
         FROM LawArticle a
         LEFT JOIN LawCaption c ON c.Id = a.CaptionId
         WHERE a.LawLevel = @param0
           AND a.LawName = @param1
         ORDER BY a.ArticleNo`,
        [lawLevel, decodeURIComponent(lawName)]
    );

    const law = lawResult.recordset[0];
    law.Articles = articlesResult.recordset;
    res.json(law);
}));

module.exports = router;