const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all incident timeline events
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_timelines ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET incident timeline event by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM incident_timelines WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create incident timeline event
router.post('/', async (req, res) => {
  try {
    const { crisis_id, event_title, event_description, event_type, timestamp, reported_by, impact_level } = req.body;
    const result = await pool.query(
      `INSERT INTO incident_timelines (crisis_id, event_title, event_description, event_type, timestamp, reported_by, impact_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [crisis_id, event_title, event_description, event_type, timestamp, reported_by, impact_level]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update incident timeline event
router.put('/:id', async (req, res) => {
  try {
    const { crisis_id, event_title, event_description, event_type, timestamp, reported_by, impact_level } = req.body;
    const result = await pool.query(
      `UPDATE incident_timelines SET crisis_id = $1, event_title = $2, event_description = $3, event_type = $4, timestamp = $5, reported_by = $6, impact_level = $7
       WHERE id = $8 RETURNING *`,
      [crisis_id, event_title, event_description, event_type, timestamp, reported_by, impact_level, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE incident timeline event
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM incident_timelines WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
