const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all post-crisis analyses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM post_crisis_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET post-crisis analysis by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM post_crisis_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create post-crisis analysis
router.post('/', async (req, res) => {
  try {
    const { crisis_id, title, summary, what_went_well, what_went_wrong, recommendations, metrics, ai_analysis, status } = req.body;
    const result = await pool.query(
      `INSERT INTO post_crisis_analyses (crisis_id, title, summary, what_went_well, what_went_wrong, recommendations, metrics, ai_analysis, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [crisis_id, title, summary, what_went_well, what_went_wrong, recommendations, metrics, ai_analysis, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI post-crisis analysis
router.post('/generate', async (req, res) => {
  try {
    const { crisis_title, crisis_description, timeline_summary, response_actions, outcomes } = req.body;

    const systemPrompt = 'You are a crisis management analyst. Generate a comprehensive post-crisis analysis report. Include sections for: executive summary, what went well, what went wrong, key recommendations for improvement, and metrics to track. Be thorough, objective, and actionable in your analysis.';

    const userPrompt = `Generate a post-crisis analysis for the following crisis:
Crisis Title: ${crisis_title || 'N/A'}
Crisis Description: ${crisis_description || 'N/A'}
Timeline Summary: ${timeline_summary || 'N/A'}
Response Actions Taken: ${response_actions || 'N/A'}
Outcomes: ${outcomes || 'N/A'}`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    res.json({ generated_content: aiContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update post-crisis analysis
router.put('/:id', async (req, res) => {
  try {
    const { crisis_id, title, summary, what_went_well, what_went_wrong, recommendations, metrics, ai_analysis, status } = req.body;
    const result = await pool.query(
      `UPDATE post_crisis_analyses SET crisis_id = $1, title = $2, summary = $3, what_went_well = $4, what_went_wrong = $5, recommendations = $6, metrics = $7, ai_analysis = $8, status = $9
       WHERE id = $10 RETURNING *`,
      [crisis_id, title, summary, what_went_well, what_went_wrong, recommendations, metrics, ai_analysis, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE post-crisis analysis
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM post_crisis_analyses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
