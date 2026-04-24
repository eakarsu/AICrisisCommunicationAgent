const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all talking points
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM talking_points ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET talking point by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM talking_points WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create talking point
router.post('/', async (req, res) => {
  try {
    const { crisis_id, topic, points, target_audience, tone, spokesperson, ai_generated, status } = req.body;
    const result = await pool.query(
      `INSERT INTO talking_points (crisis_id, topic, points, target_audience, tone, spokesperson, ai_generated, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [crisis_id, topic, points, target_audience, tone, spokesperson, ai_generated, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI talking points
router.post('/generate', async (req, res) => {
  try {
    const { crisis_title, crisis_description, topic, target_audience, tone, spokesperson } = req.body;

    const systemPrompt = 'You are a crisis communication strategist. Generate clear, concise talking points for a spokesperson to use during a crisis. Each talking point should be direct, empathetic, and factual. Format as a numbered list of talking points. Include key messages, anticipated questions and answers, and bridging statements.';

    const userPrompt = `Generate talking points for the following crisis:
Crisis Title: ${crisis_title || 'N/A'}
Crisis Description: ${crisis_description || 'N/A'}
Topic: ${topic || 'N/A'}
Target Audience: ${target_audience || 'General public'}
Desired Tone: ${tone || 'empathetic and professional'}
Spokesperson: ${spokesperson || 'Company spokesperson'}`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    res.json({ generated_content: aiContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update talking point
router.put('/:id', async (req, res) => {
  try {
    const { crisis_id, topic, points, target_audience, tone, spokesperson, ai_generated, status } = req.body;
    const result = await pool.query(
      `UPDATE talking_points SET crisis_id = $1, topic = $2, points = $3, target_audience = $4, tone = $5, spokesperson = $6, ai_generated = $7, status = $8
       WHERE id = $9 RETURNING *`,
      [crisis_id, topic, points, target_audience, tone, spokesperson, ai_generated, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE talking point
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM talking_points WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
