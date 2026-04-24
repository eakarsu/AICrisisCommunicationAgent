const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateAIResponse } = require('../services/openrouter');

// GET all sentiment analyses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sentiment_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET sentiment analysis by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sentiment_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create sentiment analysis
router.post('/', async (req, res) => {
  try {
    const { text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis } = req.body;
    const result = await pool.query(
      `INSERT INTO sentiment_analyses (text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST analyze sentiment with AI
router.post('/analyze', async (req, res) => {
  try {
    const { text_input, source } = req.body;

    if (!text_input) {
      return res.status(400).json({ error: 'text_input is required' });
    }

    const systemPrompt = 'You are a sentiment analysis expert. Analyze the given text and return a JSON object with the following fields: sentiment_score (number between -1 and 1), sentiment_label (positive, negative, neutral, or mixed), key_phrases (comma-separated string of key phrases), emotions (comma-separated string of detected emotions), analysis (a brief text summary of the sentiment analysis). Return ONLY valid JSON, no markdown formatting.';

    const userPrompt = `Analyze the sentiment of the following text:\n\n"${text_input}"`;

    const aiContent = await generateAIResponse(systemPrompt, userPrompt);

    let parsed;
    try {
      parsed = JSON.parse(aiContent);
    } catch {
      parsed = {
        sentiment_score: 0,
        sentiment_label: 'neutral',
        key_phrases: '',
        emotions: '',
        analysis: aiContent,
      };
    }

    const result = await pool.query(
      `INSERT INTO sentiment_analyses (text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [text_input, parsed.sentiment_score, parsed.sentiment_label, parsed.key_phrases, parsed.emotions, source || 'manual', parsed.analysis || aiContent]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update sentiment analysis
router.put('/:id', async (req, res) => {
  try {
    const { text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis } = req.body;
    const result = await pool.query(
      `UPDATE sentiment_analyses SET text_input = $1, sentiment_score = $2, sentiment_label = $3, key_phrases = $4, emotions = $5, source = $6, ai_analysis = $7
       WHERE id = $8 RETURNING *`,
      [text_input, sentiment_score, sentiment_label, key_phrases, emotions, source, ai_analysis, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE sentiment analysis
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sentiment_analyses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
