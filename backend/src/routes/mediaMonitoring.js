const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all media monitoring entries
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM media_monitoring ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET media monitoring entry by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM media_monitoring WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create media monitoring entry
router.post('/', async (req, res) => {
  try {
    const { source, title, url, sentiment, reach, platform, summary, published_at } = req.body;
    const result = await pool.query(
      `INSERT INTO media_monitoring (source, title, url, sentiment, reach, platform, summary, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [source, title, url, sentiment, reach, platform, summary, published_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update media monitoring entry
router.put('/:id', async (req, res) => {
  try {
    const { source, title, url, sentiment, reach, platform, summary, published_at } = req.body;
    const result = await pool.query(
      `UPDATE media_monitoring SET source = $1, title = $2, url = $3, sentiment = $4, reach = $5, platform = $6, summary = $7, published_at = $8
       WHERE id = $9 RETURNING *`,
      [source, title, url, sentiment, reach, platform, summary, published_at, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE media monitoring entry
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM media_monitoring WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
