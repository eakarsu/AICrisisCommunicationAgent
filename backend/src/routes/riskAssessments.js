const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all risk assessments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM risk_assessments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET risk assessment by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM risk_assessments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create risk assessment
router.post('/', async (req, res) => {
  try {
    const { title, description, category, likelihood, impact, risk_score, mitigation_strategy, status, ai_analysis } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_assessments (title, description, category, likelihood, impact, risk_score, mitigation_strategy, status, ai_analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, category, likelihood, impact, risk_score, mitigation_strategy, status, ai_analysis]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI risk assessment
router.post('/generate', async (req, res) => {
  try {
    const { title, description, category, context } = req.body;

    const systemPrompt = 'You are a risk assessment expert specializing in crisis management. Analyze the given risk scenario and provide a comprehensive assessment including likelihood (1-5), impact (1-5), risk score (likelihood x impact), detailed mitigation strategy, and analysis. Return your response as a JSON object with fields: likelihood, impact, risk_score, mitigation_strategy, analysis. Return ONLY valid JSON, no markdown formatting.';

    const userPrompt = `Assess the following risk:
Title: ${title || 'N/A'}
Description: ${description || 'N/A'}
Category: ${category || 'N/A'}
Additional Context: ${context || 'N/A'}`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    res.json({ generated_content: aiContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update risk assessment
router.put('/:id', async (req, res) => {
  try {
    const { title, description, category, likelihood, impact, risk_score, mitigation_strategy, status, ai_analysis } = req.body;
    const result = await pool.query(
      `UPDATE risk_assessments SET title = $1, description = $2, category = $3, likelihood = $4, impact = $5, risk_score = $6, mitigation_strategy = $7, status = $8, ai_analysis = $9
       WHERE id = $10 RETURNING *`,
      [title, description, category, likelihood, impact, risk_score, mitigation_strategy, status, ai_analysis, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE risk assessment
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM risk_assessments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
