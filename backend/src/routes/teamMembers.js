const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET all team members
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM team_members ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET team member by id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM team_members WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create team member
router.post('/', async (req, res) => {
  try {
    const { name, email, role, department, phone, availability, skills, assigned_crisis_id } = req.body;
    const result = await pool.query(
      `INSERT INTO team_members (name, email, role, department, phone, availability, skills, assigned_crisis_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, email, role, department, phone, availability, skills, assigned_crisis_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update team member
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, department, phone, availability, skills, assigned_crisis_id } = req.body;
    const result = await pool.query(
      `UPDATE team_members SET name = $1, email = $2, role = $3, department = $4, phone = $5, availability = $6, skills = $7, assigned_crisis_id = $8
       WHERE id = $9 RETURNING *`,
      [name, email, role, department, phone, availability, skills, assigned_crisis_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE team member
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM team_members WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
