const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all press releases
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM press_releases ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET press release by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM press_releases WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create press release
router.post('/', async (req, res) => {
  try {
    const { title, content, crisis_id, status, target_audience, ai_generated } = req.body;
    const result = await pool.query(
      `INSERT INTO press_releases (title, content, crisis_id, status, target_audience, ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, content, crisis_id, status, target_audience, ai_generated]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI press release
router.post('/generate', async (req, res) => {
  try {
    const { crisis_title, crisis_description, severity, target_audience, key_facts } = req.body;

    const systemPrompt = 'You are a crisis communication expert. Generate a professional press release based on the crisis details provided. Include a headline, dateline, body with quotes, and boilerplate. Be factual and reassuring.';

    const userPrompt = `Generate a press release for the following crisis:
Title: ${crisis_title || 'N/A'}
Description: ${crisis_description || 'N/A'}
Severity: ${severity || 'N/A'}
Target Audience: ${target_audience || 'General public'}
Key Facts: ${key_facts || 'N/A'}`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    res.json({ generated_content: aiContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update press release
router.put('/:id', async (req, res) => {
  try {
    const { title, content, crisis_id, status, target_audience, ai_generated } = req.body;
    const result = await pool.query(
      `UPDATE press_releases SET title = $1, content = $2, crisis_id = $3, status = $4, target_audience = $5, ai_generated = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [title, content, crisis_id, status, target_audience, ai_generated, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE press release
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM press_releases WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
