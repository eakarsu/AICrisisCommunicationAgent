const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all communication logs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM communication_logs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET communication log by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM communication_logs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create communication log
router.post('/', async (req, res) => {
  try {
    const { crisis_id, channel, sender, recipient, message, direction, status } = req.body;
    const result = await pool.query(
      `INSERT INTO communication_logs (crisis_id, channel, sender, recipient, message, direction, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [crisis_id, channel, sender, recipient, message, direction, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update communication log
router.put('/:id', async (req, res) => {
  try {
    const { crisis_id, channel, sender, recipient, message, direction, status } = req.body;
    const result = await pool.query(
      `UPDATE communication_logs SET crisis_id = $1, channel = $2, sender = $3, recipient = $4, message = $5, direction = $6, status = $7
       WHERE id = $8 RETURNING *`,
      [crisis_id, channel, sender, recipient, message, direction, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE communication log
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM communication_logs WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
