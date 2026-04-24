const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all stakeholders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stakeholders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stakeholder by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stakeholders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create stakeholder
router.post('/', async (req, res) => {
  try {
    const { name, organization, role, email, phone, priority, relationship, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO stakeholders (name, organization, role, email, phone, priority, relationship, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, organization, role, email, phone, priority, relationship, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update stakeholder
router.put('/:id', async (req, res) => {
  try {
    const { name, organization, role, email, phone, priority, relationship, notes } = req.body;
    const result = await pool.query(
      `UPDATE stakeholders SET name = $1, organization = $2, role = $3, email = $4, phone = $5, priority = $6, relationship = $7, notes = $8
       WHERE id = $9 RETURNING *`,
      [name, organization, role, email, phone, priority, relationship, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE stakeholder
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM stakeholders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
