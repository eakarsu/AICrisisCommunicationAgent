const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all crisis simulations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crisis_simulations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET crisis simulation by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crisis_simulations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create crisis simulation
router.post('/', async (req, res) => {
  try {
    const { scenario_name, description, severity, objectives, participants, status, results, lessons_learned, scheduled_date } = req.body;
    const result = await pool.query(
      `INSERT INTO crisis_simulations (scenario_name, description, severity, objectives, participants, status, results, lessons_learned, scheduled_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [scenario_name, description, severity, objectives, participants, status, results, lessons_learned, scheduled_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update crisis simulation
router.put('/:id', async (req, res) => {
  try {
    const { scenario_name, description, severity, objectives, participants, status, results, lessons_learned, scheduled_date } = req.body;
    const result = await pool.query(
      `UPDATE crisis_simulations SET scenario_name = $1, description = $2, severity = $3, objectives = $4, participants = $5, status = $6, results = $7, lessons_learned = $8, scheduled_date = $9
       WHERE id = $10 RETURNING *`,
      [scenario_name, description, severity, objectives, participants, status, results, lessons_learned, scheduled_date, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE crisis simulation
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM crisis_simulations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
