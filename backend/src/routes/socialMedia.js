const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all social media responses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM social_media_responses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET social media response by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM social_media_responses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create social media response
router.post('/', async (req, res) => {
  try {
    const { platform, message, crisis_id, status, tone, character_count, ai_generated } = req.body;
    const result = await pool.query(
      `INSERT INTO social_media_responses (platform, message, crisis_id, status, tone, character_count, ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [platform, message, crisis_id, status, tone, character_count, ai_generated]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI social media response
router.post('/generate', async (req, res) => {
  try {
    const { platform, crisis_title, crisis_description, tone, max_characters } = req.body;

    const systemPrompt = 'You are a social media crisis communication specialist. Generate an appropriate social media response for the given platform. Keep it concise, empathetic, and on-brand. Respect character limits for the platform.';

    const userPrompt = `Generate a social media response for the following:
Platform: ${platform || 'Twitter'}
Crisis Title: ${crisis_title || 'N/A'}
Crisis Description: ${crisis_description || 'N/A'}
Desired Tone: ${tone || 'empathetic and professional'}
Max Characters: ${max_characters || '280'}`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    res.json({ generated_content: aiContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update social media response
router.put('/:id', async (req, res) => {
  try {
    const { platform, message, crisis_id, status, tone, character_count, ai_generated } = req.body;
    const result = await pool.query(
      `UPDATE social_media_responses SET platform = $1, message = $2, crisis_id = $3, status = $4, tone = $5, character_count = $6, ai_generated = $7
       WHERE id = $8 RETURNING *`,
      [platform, message, crisis_id, status, tone, character_count, ai_generated, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE social media response
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM social_media_responses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
