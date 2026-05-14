const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// GET all media monitoring entries (paginated)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM media_monitoring ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM media_monitoring'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
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

// POST create media monitoring entry (also serves as POST /api/media/mentions)
router.post(
  '/',
  [
    body('source').notEmpty().withMessage('source is required'),
    body('sentiment')
      .optional()
      .isIn(['positive', 'neutral', 'negative'])
      .withMessage('sentiment must be positive, neutral, or negative'),
    body('reach').optional().isInt({ min: 0 }).withMessage('reach must be a non-negative integer'),
  ],
  validate,
  async (req, res) => {
    try {
      const { source, title, url, sentiment, reach, platform, summary, published_at, incident_id } = req.body;
      const result = await pool.query(
        `INSERT INTO media_monitoring (source, title, url, sentiment, reach, platform, summary, published_at, incident_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [source, title, url, sentiment, reach, platform, summary, published_at, incident_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update media monitoring entry
router.put('/:id', async (req, res) => {
  try {
    const { source, title, url, sentiment, reach, platform, summary, published_at } = req.body;
    const result = await pool.query(
      `UPDATE media_monitoring SET source = $1, title = $2, url = $3, sentiment = $4, reach = $5,
       platform = $6, summary = $7, published_at = $8 WHERE id = $9 RETURNING *`,
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

// ── GET /coverage?incident_id= — coverage timeline for an incident ─────────
router.get('/coverage/timeline', async (req, res) => {
  try {
    const { incident_id } = req.query;
    if (!incident_id) return res.status(400).json({ error: 'incident_id query param required' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT * FROM media_monitoring WHERE incident_id = $1
         ORDER BY COALESCE(published_at, created_at) ASC LIMIT $2 OFFSET $3`,
        [incident_id, limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM media_monitoring WHERE incident_id = $1', [incident_id]),
    ]);

    res.json({
      incident_id: parseInt(incident_id),
      data: data.rows,
      total: parseInt(count.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /dashboard — sentiment trend, top sources, coverage velocity ────────
router.get('/coverage/dashboard', async (req, res) => {
  try {
    const [sentimentBreakdown, topSources, recentVelocity, total] = await Promise.all([
      pool.query(
        `SELECT sentiment, COUNT(*) as count
         FROM media_monitoring GROUP BY sentiment ORDER BY count DESC`
      ),
      pool.query(
        `SELECT source, COUNT(*) as mention_count, SUM(reach) as total_reach
         FROM media_monitoring GROUP BY source ORDER BY mention_count DESC LIMIT 10`
      ),
      pool.query(
        `SELECT DATE_TRUNC('hour', COALESCE(published_at, created_at)) as hour,
                COUNT(*) as articles
         FROM media_monitoring
         WHERE COALESCE(published_at, created_at) >= NOW() - INTERVAL '72 hours'
         GROUP BY hour ORDER BY hour ASC`
      ),
      pool.query('SELECT COUNT(*) as count, SUM(reach) as total_reach FROM media_monitoring'),
    ]);

    res.json({
      sentiment_breakdown: sentimentBreakdown.rows,
      top_sources: topSources.rows,
      coverage_velocity_72h: recentVelocity.rows,
      totals: {
        articles: parseInt(total.rows[0].count),
        total_reach: parseInt(total.rows[0].total_reach) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
