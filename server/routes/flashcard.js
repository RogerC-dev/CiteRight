const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/flashcards:
 *   get:
 *     summary: Get user flashcards
 *     description: Retrieve all flashcards for the current user
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, new, learning, review, mastered]
 *         description: Filter flashcards by status
 *     responses:
 *       200:
 *         description: Flashcards retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/', asyncHandler(async (req, res) => {
    const { filter = 'all' } = req.query;
    
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        let query = `
            SELECT 
                f.id,
                f.user_id,
                f.question_id,
                f.front_text,
                f.back_text,
                f.tags,
                f.status,
                f.ease_factor,
                f.interval_days,
                f.repetitions,
                f.next_review_date,
                f.created_at,
                f.updated_at,
                q.subject,
                q.exam_type,
                q.exam_year
            FROM Flashcards f
            LEFT JOIN QuizQuestions q ON f.question_id = q.id
            WHERE f.user_id = @userId
        `;

        const request = database.getRequest();
        request.input('userId', userId);

        if (filter !== 'all') {
            query += ` AND f.status = @filter`;
            request.input('filter', filter);
        }

        query += ` ORDER BY f.next_review_date ASC, f.created_at DESC`;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset.map(f => ({
                id: f.id,
                userId: f.user_id,
                questionId: f.question_id,
                frontText: f.front_text,
                backText: f.back_text,
                tags: f.tags ? JSON.parse(f.tags) : [],
                status: f.status,
                easeFactor: f.ease_factor,
                intervalDays: f.interval_days,
                repetitions: f.repetitions,
                nextReviewDate: f.next_review_date,
                createdAt: f.created_at,
                updatedAt: f.updated_at,
                subject: f.subject,
                examType: f.exam_type,
                examYear: f.exam_year
            }))
        });
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch flashcards',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/flashcards:
 *   post:
 *     summary: Create a flashcard
 *     description: Create a new flashcard for the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frontText
 *               - backText
 *             properties:
 *               questionId:
 *                 type: integer
 *               frontText:
 *                 type: string
 *               backText:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Flashcard created successfully
 *       500:
 *         description: Server error
 */
router.post('/', asyncHandler(async (req, res) => {
    const { questionId, frontText, backText, tags = [] } = req.body;
    
    if (!frontText || !backText) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: frontText, backText'
        });
    }

    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        const request = database.getRequest();
        request.input('userId', userId);
        request.input('questionId', questionId || null);
        request.input('frontText', frontText);
        request.input('backText', backText);
        request.input('tags', JSON.stringify(tags));
        
        // Initialize SRS values
        const easeFactor = 2.5;
        const intervalDays = 1;
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

        const result = await request.query(`
            INSERT INTO Flashcards 
                (user_id, question_id, front_text, back_text, tags, status, ease_factor, interval_days, repetitions, next_review_date, created_at, updated_at)
            OUTPUT INSERTED.id, INSERTED.created_at
            VALUES 
                (@userId, @questionId, @frontText, @backText, @tags, 'new', ${easeFactor}, ${intervalDays}, 0, @nextReviewDate, GETDATE(), GETDATE())
        `);

        const flashcardId = result.recordset[0].id;

        res.json({
            success: true,
            data: {
                id: flashcardId,
                userId,
                questionId,
                frontText,
                backText,
                tags,
                status: 'new',
                easeFactor,
                intervalDays,
                repetitions: 0,
                nextReviewDate: nextReviewDate.toISOString(),
                createdAt: result.recordset[0].created_at
            }
        });
    } catch (error) {
        console.error('Error creating flashcard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create flashcard',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/flashcards/:id/review:
 *   put:
 *     summary: Update flashcard review status
 *     description: Update flashcard after review using spaced repetition algorithm
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quality
 *             properties:
 *               quality:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *                 description: Review quality (0=forgot, 5=perfect)
 *     responses:
 *       200:
 *         description: Flashcard updated successfully
 *       500:
 *         description: Server error
 */
router.put('/:id/review', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quality } = req.body;
    
    if (quality === undefined || quality < 0 || quality > 5) {
        return res.status(400).json({
            success: false,
            error: 'Quality must be between 0 and 5'
        });
    }

    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        
        // Get current flashcard
        const getRequest = database.getRequest();
        getRequest.input('id', parseInt(id));
        getRequest.input('userId', userId);
        const getResult = await getRequest.query(`
            SELECT ease_factor, interval_days, repetitions, status
            FROM Flashcards
            WHERE id = @id AND user_id = @userId
        `);

        if (getResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Flashcard not found'
            });
        }

        const flashcard = getResult.recordset[0];
        let easeFactor = flashcard.ease_factor;
        let intervalDays = flashcard.interval_days;
        let repetitions = flashcard.repetitions;
        let status = flashcard.status;

        // SM-2 Algorithm (Simplified Spaced Repetition)
        if (quality >= 3) {
            // Correct answer
            if (repetitions === 0) {
                intervalDays = 1;
            } else if (repetitions === 1) {
                intervalDays = 6;
            } else {
                intervalDays = Math.round(intervalDays * easeFactor);
            }
            repetitions += 1;
            easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
            
            if (status === 'new') {
                status = 'learning';
            } else if (intervalDays >= 21) {
                status = 'mastered';
            } else {
                status = 'review';
            }
        } else {
            // Incorrect answer
            repetitions = 0;
            intervalDays = 1;
            easeFactor = Math.max(1.3, easeFactor - 0.2);
            status = 'learning';
        }

        // Calculate next review date
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

        // Update flashcard
        const updateRequest = database.getRequest();
        updateRequest.input('id', parseInt(id));
        updateRequest.input('userId', userId);
        updateRequest.input('easeFactor', easeFactor);
        updateRequest.input('intervalDays', intervalDays);
        updateRequest.input('repetitions', repetitions);
        updateRequest.input('status', status);
        updateRequest.input('nextReviewDate', nextReviewDate);

        await updateRequest.query(`
            UPDATE Flashcards
            SET ease_factor = @easeFactor,
                interval_days = @intervalDays,
                repetitions = @repetitions,
                status = @status,
                next_review_date = @nextReviewDate,
                updated_at = GETDATE()
            WHERE id = @id AND user_id = @userId
        `);

        res.json({
            success: true,
            data: {
                id: parseInt(id),
                easeFactor,
                intervalDays,
                repetitions,
                status,
                nextReviewDate: nextReviewDate.toISOString()
            }
        });
    } catch (error) {
        console.error('Error updating flashcard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update flashcard',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/flashcards/due:
 *   get:
 *     summary: Get due flashcards
 *     description: Get flashcards that are due for review
 *     responses:
 *       200:
 *         description: Due flashcards retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/due', asyncHandler(async (req, res) => {
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        const today = new Date().toISOString().split('T')[0];
        
        const request = database.getRequest();
        request.input('userId', userId);
        request.input('today', today);
        
        const result = await request.query(`
            SELECT 
                f.id,
                f.front_text,
                f.back_text,
                f.tags,
                f.status,
                f.next_review_date,
                CASE 
                    WHEN f.next_review_date <= @today THEN 'urgent'
                    WHEN f.next_review_date <= DATEADD(day, 1, @today) THEN 'soon'
                    ELSE 'normal'
                END as priority
            FROM Flashcards f
            WHERE f.user_id = @userId
            AND f.next_review_date <= DATEADD(day, 7, @today)
            ORDER BY 
                CASE 
                    WHEN f.next_review_date <= @today THEN 1
                    WHEN f.next_review_date <= DATEADD(day, 1, @today) THEN 2
                    ELSE 3
                END,
                f.next_review_date ASC
        `);

        const urgent = result.recordset.filter(f => f.priority === 'urgent').length;
        const soon = result.recordset.filter(f => f.priority === 'soon').length;
        const normal = result.recordset.filter(f => f.priority === 'normal').length;

        res.json({
            success: true,
            data: {
                flashcards: result.recordset.map(f => ({
                    id: f.id,
                    frontText: f.front_text,
                    backText: f.back_text,
                    tags: f.tags ? JSON.parse(f.tags) : [],
                    status: f.status,
                    nextReviewDate: f.next_review_date,
                    priority: f.priority
                })),
                summary: {
                    urgent,
                    soon,
                    normal,
                    total: result.recordset.length
                }
            }
        });
    } catch (error) {
        console.error('Error fetching due flashcards:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch due flashcards',
            message: error.message
        });
    }
}));

module.exports = router;

