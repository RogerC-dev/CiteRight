const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const axios = require('axios');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send chat message to AI
 *     description: Send a message to the AI assistant and get a response
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               conversationId:
 *                 type: string
 *               model:
 *                 type: string
 *                 enum: [gpt-4, gpt-3.5-turbo, gemini, claude]
 *     responses:
 *       200:
 *         description: AI response received
 *       500:
 *         description: Server error
 */
router.post('/chat', asyncHandler(async (req, res) => {
    const { message, conversationId, model = 'gpt-3.5-turbo' } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    try {
        const userId = req.user?.id || 'anonymous';
        const convId = conversationId || `conv_${Date.now()}_${userId}`;

        // Save user message to database
        if (database.isConnected()) {
            const saveRequest = database.getRequest();
            saveRequest.input('conversationId', convId);
            saveRequest.input('userId', userId);
            saveRequest.input('role', 'user');
            saveRequest.input('content', message);
            saveRequest.input('model', model);

            try {
                await saveRequest.query(`
                    INSERT INTO ChatMessages (conversation_id, user_id, role, content, model, created_at)
                    VALUES (@conversationId, @userId, @role, @content, @model, GETDATE())
                `);
            } catch (dbError) {
                console.warn('Failed to save message to database:', dbError.message);
                // Continue even if database save fails
            }
        }

        // Call AI API (OpenAI, Gemini, or Claude)
        let aiResponse;
        try {
            aiResponse = await callAIAPI(message, model);
        } catch (aiError) {
            console.error('AI API error:', aiError);

            // Fallback response
            aiResponse = {
                content: '抱歉，AI 服務暫時無法使用。請稍後再試。',
                model: model,
                error: aiError.message
            };
        }

        // Save AI response to database
        if (database.isConnected() && aiResponse.content) {
            const saveRequest = database.getRequest();
            saveRequest.input('conversationId', convId);
            saveRequest.input('userId', userId);
            saveRequest.input('role', 'assistant');
            saveRequest.input('content', aiResponse.content);
            saveRequest.input('model', model);

            try {
                await saveRequest.query(`
                    INSERT INTO ChatMessages (conversation_id, user_id, role, content, model, created_at)
                    VALUES (@conversationId, @userId, @role, @content, @model, GETDATE())
                `);
            } catch (dbError) {
                console.warn('Failed to save AI response to database:', dbError.message);
            }
        }

        res.json({
            success: true,
            data: {
                conversationId: convId,
                message: aiResponse.content,
                model: aiResponse.model || model,
                sources: aiResponse.sources || [],
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat message',
            message: error.message
        });
    }
}));

/**
 * Call AI API based on model
 */
async function callAIAPI(message, model) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    // Build system prompt for legal context
    const systemPrompt = `You are a legal research assistant specializing in Taiwan law. 
Provide accurate, well-cited responses about legal matters. 
When discussing laws, cite specific articles and sources. 
If you're unsure, say so rather than guessing.`;

    switch (model) {
        case 'gpt-4':
        case 'gpt-3.5-turbo':
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }
            return await callOpenAI(message, systemPrompt, model);

        case 'gemini':
            if (!geminiApiKey) {
                throw new Error('Gemini API key not configured');
            }
            return await callGemini(message, systemPrompt);

        case 'claude':
            if (!claudeApiKey) {
                throw new Error('Claude API key not configured');
            }
            return await callClaude(message, systemPrompt);

        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(message, systemPrompt, model) {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 2000
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return {
        content: response.data.choices[0].message.content,
        model: model
    };
}

/**
 * Call Google Gemini API
 */
async function callGemini(message, systemPrompt) {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`
                }]
            }]
        },
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    return {
        content: response.data.candidates[0].content.parts[0].text,
        model: 'gemini'
    };
}

/**
 * Call Anthropic Claude API
 */
async function callClaude(message, systemPrompt) {
    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
                { role: 'user', content: message }
            ]
        },
        {
            headers: {
                'x-api-key': process.env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        }
    );

    return {
        content: response.data.content[0].text,
        model: 'claude'
    };
}

/**
 * @swagger
 * /api/ai/history:
 *   get:
 *     summary: Get chat history
 *     description: Get chat history for a conversation or user
 *     parameters:
 *       - in: query
 *         name: conversationId
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: Chat history retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/history', asyncHandler(async (req, res) => {
    const { conversationId, limit = 50 } = req.query;

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
                id,
                conversation_id,
                role,
                content,
                model,
                created_at
            FROM ChatMessages
            WHERE user_id = @userId
        `;

        const request = database.getRequest();
        request.input('userId', userId);

        if (conversationId) {
            query += ` AND conversation_id = @conversationId`;
            request.input('conversationId', conversationId);
        }

        query += ` ORDER BY created_at ASC`;
        query += ` OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
        request.input('limit', parseInt(limit));

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset.map(msg => ({
                id: msg.id,
                conversationId: msg.conversation_id,
                role: msg.role,
                content: msg.content,
                model: msg.model,
                timestamp: msg.created_at
            }))
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chat history',
            message: error.message
        });
    }
}));

/**
 * @swagger
 * /api/ai/analyze-case:
 *   post:
 *     summary: Analyze legal case text
 *     description: Analyze a legal case or document text using AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Analysis completed
 *       500:
 *         description: Server error
 */
router.post('/analyze-case', asyncHandler(async (req, res) => {
    const { text, model = 'gpt-3.5-turbo' } = req.body;

    if (!text) {
        return res.status(400).json({
            success: false,
            error: 'Text is required'
        });
    }

    try {
        const analysisPrompt = `請分析以下法律案例文本，提供：
1. 案件類型
2. 主要爭點
3. 相關法條
4. 判決要旨
5. 法律見解

案例文本：
${text}`;

        const aiResponse = await callAIAPI(analysisPrompt, model);

        res.json({
            success: true,
            data: {
                analysis: aiResponse.content,
                model: aiResponse.model || model,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error analyzing case:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze case',
            message: error.message
        });
    }
}));

module.exports = router;

