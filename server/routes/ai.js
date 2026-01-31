const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const axios = require('axios');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send chat message to AI
 *     description: Send a message to the AI assistant and get a response. Requires authentication.
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
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
router.post('/chat', asyncHandler(async (req, res) => {
    const { message, conversationId, model = 'gpt-4o-mini', context = [] } = req.body;

    // REQUIRE LOGIN: Check for authenticated Supabase user
    const supabaseUserId = req.headers['x-supabase-user-id'];
    if (!supabaseUserId || supabaseUserId === 'anonymous') {
        return res.status(401).json({
            success: false,
            error: '請先登入以使用 AI 功能',
            requireLogin: true
        });
    }

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    try {
        const convId = conversationId || `conv_${Date.now()}_${supabaseUserId}`;

        // Call AI API (OpenAI, Gemini, or Claude) with context
        let aiResponse;
        try {
            aiResponse = await callAIAPI(message, model, context);
        } catch (aiError) {
            console.error('AI API error:', aiError);

            // Fallback response
            aiResponse = {
                content: '抱歉，AI 服務暫時無法使用。請稍後再試。',
                model: model,
                error: aiError.message
            };
        }

        // Note: Storage is now handled by Supabase Edge Function directly
        // This endpoint just provides the AI response
        // The extension should call the Edge Function to save the conversation

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
async function callAIAPI(message, model, context = []) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    // Build system prompt for legal context
    const systemPrompt = `You are a legal research assistant specializing in Taiwan law. 
Provide accurate, well-cited responses about legal matters. 
When discussing laws, cite specific articles and sources. 
Respond in Traditional Chinese (zh-TW) unless the user writes in another language.
If you're unsure, say so rather than guessing.`;

    switch (model) {
        case 'gpt-4':
        case 'gpt-4o':
        case 'gpt-4o-mini':
        case 'gpt-3.5-turbo':
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured. Please check server/.env file.');
            }
            return await callOpenAI(message, systemPrompt, model, context);

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
            // Default to gpt-4o-mini if model not recognized
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured. Please check server/.env file.');
            }
            return await callOpenAI(message, systemPrompt, 'gpt-4o-mini', context);
    }
}

/**
 * Call OpenAI API with conversation context
 */
async function callOpenAI(message, systemPrompt, model, context = []) {
    // Build messages array with context
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    // Add conversation context (last 10 messages to save tokens)
    const recentContext = context.slice(-10);
    for (const msg of recentContext) {
        if (msg.role && msg.content) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: model,
            messages: messages,
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
    // Chat history is now stored in Supabase and accessed via Edge Functions
    // This endpoint is deprecated - clients should query Supabase directly
    const userId = req.headers['x-supabase-user-id'];

    if (!userId || userId === 'anonymous') {
        return res.status(401).json({
            success: false,
            error: '請先登入以查看對話記錄',
            requireLogin: true
        });
    }

    // Return empty data - client should fetch from Supabase directly
    res.json({
        success: true,
        data: [],
        message: 'Chat history is now stored in Supabase. Please use the Supabase API directly.'
    });
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

