const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/analytics/progress:
 *   get:
 *     summary: Get learning progress
 *     description: Get user's overall learning progress and statistics
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7, 30, 90, all]
 *         description: Time range in days
 *     responses:
 *       200:
 *         description: Progress data retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/progress', asyncHandler(async (req, res) => {
    const { timeRange = 'all' } = req.query;
    
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        let dateFilter = '';
        
        if (timeRange !== 'all') {
            const days = parseInt(timeRange);
            dateFilter = `AND ua.created_at >= DATEADD(day, -${days}, GETDATE())`;
        }

        // Get overall progress
        const progressRequest = database.getRequest();
        progressRequest.input('userId', userId);
        
        const progressResult = await progressRequest.query(`
            SELECT 
                COUNT(DISTINCT q.id) as total_questions,
                COUNT(DISTINCT ua.question_id) as practiced_questions,
                COUNT(*) as total_attempts,
                SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                CAST(SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as accuracy
            FROM QuizQuestions q
            LEFT JOIN UserAnswers ua ON q.id = ua.question_id AND ua.user_id = @userId ${dateFilter}
            WHERE q.status = 'published'
        `);

        const progress = progressResult.recordset[0];
        const totalQuestions = progress.total_questions || 0;
        const practicedQuestions = progress.practiced_questions || 0;
        const totalAttempts = progress.total_attempts || 0;
        const correctAttempts = progress.correct_attempts || 0;
        const accuracy = progress.accuracy || 0;
        const progressPercentage = totalQuestions > 0 ? Math.round((practicedQuestions / totalQuestions) * 100) : 0;

        // Get daily progress trend
        const trendRequest = database.getRequest();
        trendRequest.input('userId', userId);
        const days = timeRange === 'all' ? 90 : parseInt(timeRange);
        
        const trendResult = await trendRequest.query(`
            SELECT 
                CAST(ua.created_at AS DATE) as date,
                COUNT(*) as attempts,
                SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct
            FROM UserAnswers ua
            WHERE ua.user_id = @userId
            AND ua.created_at >= DATEADD(day, -${days}, GETDATE())
            GROUP BY CAST(ua.created_at AS DATE)
            ORDER BY date ASC
        `);

        res.json({
            success: true,
            data: {
                overall: {
                    totalQuestions,
                    practicedQuestions,
                    progressPercentage,
                    totalAttempts,
                    correctAttempts,
                    accuracy: Math.round(accuracy)
                },
                trend: trendResult.recordset.map(t => ({
                    date: t.date,
                    attempts: t.attempts,
                    correct: t.correct,
                    accuracy: t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : 0
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch progress',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/analytics/subject-breakdown:
 *   get:
 *     summary: Get subject breakdown
 *     description: Get statistics broken down by subject
 *     responses:
 *       200:
 *         description: Subject breakdown retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/subject-breakdown', asyncHandler(async (req, res) => {
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
        
        const result = await request.query(`
            SELECT 
                q.subject,
                COUNT(DISTINCT q.id) as total_questions,
                COUNT(DISTINCT ua.question_id) as practiced_questions,
                COUNT(ua.id) as total_attempts,
                SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                CAST(SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ua.id), 0) AS DECIMAL(5,2)) as accuracy
            FROM QuizQuestions q
            LEFT JOIN UserAnswers ua ON q.id = ua.question_id AND ua.user_id = @userId
            WHERE q.status = 'published'
            GROUP BY q.subject
            ORDER BY total_questions DESC
        `);

        // Get weak areas (subjects with low accuracy)
        const weakAreas = result.recordset
            .filter(s => s.accuracy !== null && s.accuracy < 70)
            .map(s => s.subject)
            .slice(0, 3);

        res.json({
            success: true,
            data: {
                subjects: result.recordset.map(s => ({
                    subject: s.subject,
                    totalQuestions: s.total_questions || 0,
                    practicedQuestions: s.practiced_questions || 0,
                    totalAttempts: s.total_attempts || 0,
                    correctAttempts: s.correct_attempts || 0,
                    accuracy: s.accuracy ? Math.round(s.accuracy) : 0,
                    progressPercentage: s.total_questions > 0 
                        ? Math.round((s.practiced_questions / s.total_questions) * 100) 
                        : 0
                })),
                weakAreas
            }
        });
    } catch (error) {
        console.error('Error fetching subject breakdown:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subject breakdown',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/analytics/wrong-questions:
 *   get:
 *     summary: Get wrong questions
 *     description: Get questions the user has answered incorrectly
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of questions to return
 *     responses:
 *       200:
 *         description: Wrong questions retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/wrong-questions', asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query;
    
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
        request.input('limit', parseInt(limit));
        
        const result = await request.query(`
            SELECT TOP (@limit)
                q.id,
                q.question_number,
                q.question_text,
                q.exam_type,
                q.exam_year,
                q.subject,
                q.question_type,
                q.explanation,
                COUNT(ua.id) as error_count,
                MAX(ua.created_at) as last_attempt_date
            FROM QuizQuestions q
            INNER JOIN UserAnswers ua ON q.id = ua.question_id
            WHERE ua.user_id = @userId
            AND ua.is_correct = 0
            AND q.status = 'published'
            GROUP BY q.id, q.question_number, q.question_text, q.exam_type, q.exam_year, q.subject, q.question_type, q.explanation
            ORDER BY error_count DESC, last_attempt_date DESC
        `);

        res.json({
            success: true,
            data: result.recordset.map(q => ({
                id: q.id,
                questionNumber: q.question_number,
                questionText: q.question_text,
                examType: q.exam_type,
                examYear: q.exam_year,
                subject: q.subject,
                questionType: q.question_type,
                explanation: q.explanation,
                errorCount: q.error_count,
                lastAttemptDate: q.last_attempt_date
            }))
        });
    } catch (error) {
        console.error('Error fetching wrong questions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wrong questions',
            message: error.message
        });
    }
}));

module.exports = router;

