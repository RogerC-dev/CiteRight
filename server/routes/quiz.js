const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/quiz/questions:
 *   get:
 *     summary: Get quiz questions with filters
 *     description: Retrieve quiz questions based on filters (exam type, year, subject, question type, keyword)
 *     parameters:
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [judicial, lawyer]
 *         description: Exam type filter
 *       - in: query
 *         name: examYear
 *         schema:
 *           type: string
 *         description: Exam year filter
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Subject filter
 *       - in: query
 *         name: questionType
 *         schema:
 *           type: string
 *           enum: [choice, essay]
 *         description: Question type filter
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Keyword search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/questions', asyncHandler(async (req, res) => {
    const { examType, examYear, subject, questionType, keyword, page = 1, limit = 20 } = req.query;
    
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        let query = `
            SELECT 
                q.id,
                q.question_number,
                q.question_text,
                q.exam_type,
                q.exam_year,
                q.subject,
                q.question_type,
                q.options,
                q.correct_answer,
                q.explanation,
                q.difficulty,
                q.status,
                q.created_at,
                q.updated_at
            FROM QuizQuestions q
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 0;

        if (examType) {
            query += ` AND q.exam_type = @examType`;
            params.push({ name: 'examType', value: examType });
        }

        if (examYear) {
            query += ` AND q.exam_year = @examYear`;
            params.push({ name: 'examYear', value: examYear });
        }

        if (subject) {
            query += ` AND q.subject = @subject`;
            params.push({ name: 'subject', value: subject });
        }

        if (questionType) {
            query += ` AND q.question_type = @questionType`;
            params.push({ name: 'questionType', value: questionType });
        }

        if (keyword) {
            query += ` AND (q.question_text LIKE @keyword OR q.explanation LIKE @keyword)`;
            params.push({ name: 'keyword', value: `%${keyword}%` });
        }

        query += ` AND q.status = 'published'`;
        query += ` ORDER BY q.exam_year DESC, q.question_number ASC`;

        // Get total count
        const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const countRequest = database.getRequest();
        params.forEach(p => countRequest.input(p.name, p.value));
        const countResult = await countRequest.query(countQuery);
        const total = countResult.recordset[0].total;

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` OFFSET ${offset} ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`;

        const request = database.getRequest();
        params.forEach(p => request.input(p.name, p.value));
        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset.map(q => ({
                ...q,
                options: q.options ? JSON.parse(q.options) : null
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch questions',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/quiz/practice:
 *   post:
 *     summary: Start a practice session
 *     description: Create a new practice session with selected questions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               examType:
 *                 type: string
 *               examYear:
 *                 type: string
 *               subject:
 *                 type: string
 *               questionType:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [historical, simulation, mixed, favorites]
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Practice session created
 *       500:
 *         description: Server error
 */
router.post('/practice', asyncHandler(async (req, res) => {
    const { examType, examYear, subject, questionType, mode, questionIds } = req.body;
    
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        // Get user ID from session or token (placeholder for now)
        const userId = req.user?.id || 'anonymous';

        // Create practice session
        const sessionRequest = database.getRequest();
        sessionRequest.input('userId', userId);
        sessionRequest.input('mode', mode || 'historical');
        sessionRequest.input('examType', examType || null);
        sessionRequest.input('examYear', examYear || null);
        sessionRequest.input('subject', subject || null);
        sessionRequest.input('questionType', questionType || null);
        
        const sessionResult = await sessionRequest.query(`
            INSERT INTO PracticeSessions (user_id, mode, exam_type, exam_year, subject, question_type, created_at)
            OUTPUT INSERTED.id, INSERTED.created_at
            VALUES (@userId, @mode, @examType, @examYear, @subject, @questionType, GETDATE())
        `);

        const sessionId = sessionResult.recordset[0].id;

        // If questionIds provided, use them; otherwise fetch based on filters
        let questions = [];
        if (questionIds && questionIds.length > 0) {
            const ids = questionIds.join(',');
            const qRequest = database.getRequest();
            const qResult = await qRequest.query(`
                SELECT id, question_number, question_text, exam_type, exam_year, 
                       subject, question_type, options, correct_answer, explanation
                FROM QuizQuestions
                WHERE id IN (${ids}) AND status = 'published'
                ORDER BY exam_year DESC, question_number ASC
            `);
            questions = qResult.recordset;
        } else {
            // Fetch questions based on filters
            let query = `
                SELECT id, question_number, question_text, exam_type, exam_year, 
                       subject, question_type, options, correct_answer, explanation
                FROM QuizQuestions
                WHERE status = 'published'
            `;
            
            const qRequest = database.getRequest();
            if (examType) {
                query += ` AND exam_type = '${examType}'`;
            }
            if (examYear) {
                query += ` AND exam_year = '${examYear}'`;
            }
            if (subject) {
                query += ` AND subject = '${subject}'`;
            }
            if (questionType) {
                query += ` AND question_type = '${questionType}'`;
            }
            
            query += ` ORDER BY exam_year DESC, question_number ASC`;
            const qResult = await qRequest.query(query);
            questions = qResult.recordset;
        }

        // Create session questions
        for (const question of questions) {
            const sqRequest = database.getRequest();
            sqRequest.input('sessionId', sessionId);
            sqRequest.input('questionId', question.id);
            sqRequest.input('order', questions.indexOf(question) + 1);
            await sqRequest.query(`
                INSERT INTO SessionQuestions (session_id, question_id, order_index, created_at)
                VALUES (@sessionId, @questionId, @order, GETDATE())
            `);
        }

        res.json({
            success: true,
            data: {
                sessionId,
                questions: questions.map(q => ({
                    id: q.id,
                    questionNumber: q.question_number,
                    questionText: q.question_text,
                    examType: q.exam_type,
                    examYear: q.exam_year,
                    subject: q.subject,
                    questionType: q.question_type,
                    options: q.options ? JSON.parse(q.options) : null,
                    // Don't send correct_answer to client initially
                })),
                totalQuestions: questions.length
            }
        });
    } catch (error) {
        console.error('Error creating practice session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create practice session',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/quiz/submit:
 *   post:
 *     summary: Submit an answer
 *     description: Submit answer for a question in a practice session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - questionId
 *               - answer
 *             properties:
 *               sessionId:
 *                 type: integer
 *               questionId:
 *                 type: integer
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *       500:
 *         description: Server error
 */
router.post('/submit', asyncHandler(async (req, res) => {
    const { sessionId, questionId, answer } = req.body;
    
    if (!sessionId || !questionId || answer === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: sessionId, questionId, answer'
        });
    }

    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        // Get correct answer
        const answerRequest = database.getRequest();
        answerRequest.input('questionId', questionId);
        const answerResult = await answerRequest.query(`
            SELECT correct_answer, explanation
            FROM QuizQuestions
            WHERE id = @questionId
        `);

        if (answerResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }

        const correctAnswer = answerResult.recordset[0].correct_answer;
        const explanation = answerResult.recordset[0].explanation;
        const isCorrect = answer === correctAnswer;

        // Save answer
        const userId = req.user?.id || 'anonymous';
        const saveRequest = database.getRequest();
        saveRequest.input('sessionId', sessionId);
        saveRequest.input('questionId', questionId);
        saveRequest.input('userId', userId);
        saveRequest.input('answer', answer);
        saveRequest.input('isCorrect', isCorrect);
        
        await saveRequest.query(`
            INSERT INTO UserAnswers (session_id, question_id, user_id, answer, is_correct, created_at)
            VALUES (@sessionId, @questionId, @userId, @answer, @isCorrect, GETDATE())
        `);

        res.json({
            success: true,
            data: {
                isCorrect,
                correctAnswer,
                explanation,
                userAnswer: answer
            }
        });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit answer',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/quiz/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Get user's quiz statistics (total questions, practiced, accuracy, etc.)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/stats', asyncHandler(async (req, res) => {
    if (!database.isConnected()) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not connected' 
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';

        // Get total questions
        const totalRequest = database.getRequest();
        const totalResult = await totalRequest.query(`
            SELECT COUNT(*) as total
            FROM QuizQuestions
            WHERE status = 'published'
        `);
        const totalQuestions = totalResult.recordset[0].total;

        // Get user's practice stats
        const statsRequest = database.getRequest();
        statsRequest.input('userId', userId);
        const statsResult = await statsRequest.query(`
            SELECT 
                COUNT(DISTINCT ua.question_id) as practiced,
                SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct,
                COUNT(*) as total_attempts
            FROM UserAnswers ua
            WHERE ua.user_id = @userId
        `);

        const stats = statsResult.recordset[0];
        const practiced = stats.practiced || 0;
        const correct = stats.correct || 0;
        const totalAttempts = stats.total_attempts || 0;
        const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
        const toReview = totalAttempts - correct;

        res.json({
            success: true,
            data: {
                totalQuestions,
                practiced,
                accuracy,
                correct,
                totalAttempts,
                toReview
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
}));

module.exports = router;

