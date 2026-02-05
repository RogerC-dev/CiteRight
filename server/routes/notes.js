const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { asyncHandler } = require('../middleware/errorHandler');

// Initialize Supabase with service role key for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Helper function to extract userId from request headers
 * The userId is passed from the Chrome extension via background.js proxy
 */
function getUserId(req) {
  return req.headers['x-supabase-user-id'];
}

/**
 * @swagger
 * /api/notes:
 *   post:
 *     summary: Create a new legal note
 *     description: Creates a new note in the exam_note table
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               content_html:
 *                 type: string
 *               source_type:
 *                 type: string
 *               source_id:
 *                 type: string
 *               source_url:
 *                 type: string
 *               source_metadata:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Note created successfully
 *       401:
 *         description: User not authenticated
 *       400:
 *         description: Bad request
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  const {
    title,
    content,
    content_html,
    source_type,
    source_id,
    source_url,
    source_metadata,
    tags
  } = req.body;

  // Validate required fields
  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Content is required'
    });
  }

  const { data: note, error } = await supabase
    .from('exam_note')
    .insert({
      user_id: userId,
      title: title || null,
      content,
      content_html: content_html || null,
      source_type: source_type || null,
      source_id: source_id || null,
      source_url: source_url || null,
      source_metadata: source_metadata || null,
      tags: tags || [],
      is_pinned: false,
      is_archived: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  console.log(`✅ Created note ${note.id} for user ${userId}`);
  res.json({ success: true, data: note });
}));

/**
 * @swagger
 * /api/notes:
 *   get:
 *     summary: List user's legal notes
 *     description: Retrieve notes for the authenticated user with optional filters
 *     parameters:
 *       - in: query
 *         name: source_type
 *         schema:
 *           type: string
 *         description: Filter by source type
 *       - in: query
 *         name: source_id
 *         schema:
 *           type: string
 *         description: Filter by source ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of notes to return
 *     responses:
 *       200:
 *         description: List of notes
 *       401:
 *         description: User not authenticated
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  const { source_type, source_id, limit = 50 } = req.query;

  let query = supabase
    .from('exam_note')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (source_type) {
    query = query.eq('source_type', source_type);
  }

  if (source_id) {
    query = query.eq('source_id', source_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching notes:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  console.log(`✅ Fetched ${data.length} notes for user ${userId}`);
  res.json({ success: true, data });
}));

/**
 * @swagger
 * /api/notes/{id}:
 *   patch:
 *     summary: Update a legal note
 *     description: Update an existing note (only owner can update)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Note ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               content_html:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_pinned:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Note updated successfully
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Note not found
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  console.log(`📝 PATCH /api/notes/${id} - User: ${userId}`);
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

  if (!userId) {
    console.error('❌ No user ID found in request');
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  // Add updated_at timestamp to the updates
  const updates = {
    ...req.body,
    updated_at: new Date().toISOString()
  };

  // Remove fields that shouldn't be updated via this endpoint
  delete updates.id;
  delete updates.user_id;
  delete updates.created_at;

  console.log('✏️ Applying updates:', JSON.stringify(updates, null, 2));

  const { data, error } = await supabase
    .from('exam_note')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating note:', error);

    // Check if note doesn't exist or user doesn't own it
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you do not have permission to update it'
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  console.log(`✅ Updated note ${id} for user ${userId}`);
  res.json({ success: true, data });
}));

/**
 * @swagger
 * /api/notes/{id}:
 *   delete:
 *     summary: Archive a legal note (soft delete)
 *     description: Mark a note as archived (soft delete) - only owner can archive
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Note ID
 *     responses:
 *       200:
 *         description: Note archived successfully
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Note not found
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
  }

  const { error } = await supabase
    .from('exam_note')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error archiving note:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  console.log(`✅ Archived note ${id} for user ${userId}`);
  res.json({ success: true, message: 'Note archived successfully' });
}));

/**
 * @swagger
 * /api/notes/embed:
 *   post:
 *     summary: Generate embedding for a note (stub)
 *     description: Placeholder endpoint for embedding generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note_id
 *               - content
 *             properties:
 *               note_id:
 *                 type: string
 *               content:
 *                 type: string
 *               table:
 *                 type: string
 *     responses:
 *       200:
 *         description: Embedding generation acknowledged (not yet implemented)
 */
router.post('/embed', asyncHandler(async (req, res) => {
  const { note_id, content, table } = req.body;

  // TODO: Implement actual embedding generation using OpenAI API
  // This is a stub endpoint to prevent 404 errors
  console.log(`📝 Embedding generation requested for note ${note_id} (not yet implemented)`);

  res.json({
    success: true,
    note_id,
    message: 'Embedding generation queued (placeholder)'
  });
}));

module.exports = router;
