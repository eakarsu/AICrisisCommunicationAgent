const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all response templates
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM response_templates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET response template by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM response_templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create response template
router.post('/', async (req, res) => {
  try {
    const { name, category, template_text, variables, use_case, tone, last_used } = req.body;
    const result = await pool.query(
      `INSERT INTO response_templates (name, category, template_text, variables, use_case, tone, last_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category, template_text, variables, use_case, tone, last_used]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update response template
router.put('/:id', async (req, res) => {
  try {
    const { name, category, template_text, variables, use_case, tone, last_used } = req.body;
    const result = await pool.query(
      `UPDATE response_templates SET name = $1, category = $2, template_text = $3, variables = $4, use_case = $5, tone = $6, last_used = $7
       WHERE id = $8 RETURNING *`,
      [name, category, template_text, variables, use_case, tone, last_used, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE response template
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM response_templates WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
