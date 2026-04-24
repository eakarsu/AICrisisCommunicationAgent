const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all crisis incidents
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crisis_incidents ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET crisis incident by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create crisis incident
router.post('/', async (req, res) => {
  try {
    const { title, description, severity, status, category, location, affected_stakeholders, lead_responder } = req.body;
    const result = await pool.query(
      `INSERT INTO crisis_incidents (title, description, severity, status, category, location, affected_stakeholders, lead_responder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, severity, status, category, location, affected_stakeholders, lead_responder]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update crisis incident
router.put('/:id', async (req, res) => {
  try {
    const { title, description, severity, status, category, location, affected_stakeholders, lead_responder } = req.body;
    const result = await pool.query(
      `UPDATE crisis_incidents SET title = $1, description = $2, severity = $3, status = $4, category = $5, location = $6, affected_stakeholders = $7, lead_responder = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [title, description, severity, status, category, location, affected_stakeholders, lead_responder, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE crisis incident
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM crisis_incidents WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
