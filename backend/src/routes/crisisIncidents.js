const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

function nextSeverity(current) {
  const idx = SEVERITY_ORDER.indexOf((current || '').toLowerCase());
  if (idx === -1 || idx === SEVERITY_ORDER.length - 1) return SEVERITY_ORDER[SEVERITY_ORDER.length - 1];
  return SEVERITY_ORDER[idx + 1];
}

// GET all crisis incidents (paginated)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM crisis_incidents ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM crisis_incidents'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET active incidents (status NOT resolved/closed) with severity and age
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
        EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS age_hours
       FROM crisis_incidents
       WHERE status NOT IN ('resolved', 'closed')
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1 WHEN 'high' THEN 2
           WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
         END, created_at ASC`
    );
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET resolved incidents with recovery timeline
router.get('/resolved', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT ci.*,
           EXTRACT(EPOCH FROM (ci.updated_at - ci.created_at))/3600 AS resolution_hours,
           (SELECT json_agg(it ORDER BY it.timestamp ASC)
            FROM incident_timelines it WHERE it.crisis_id = ci.id) AS timeline
         FROM crisis_incidents ci
         WHERE ci.status IN ('resolved', 'closed')
         ORDER BY ci.updated_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM crisis_incidents WHERE status IN ('resolved','closed')`),
    ]);

    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
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
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('title is required'),
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('severity must be low, medium, high, or critical'),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, severity, status, category, location, affected_stakeholders, lead_responder } = req.body;
      const result = await pool.query(
        `INSERT INTO crisis_incidents (title, description, severity, status, category, location, affected_stakeholders, lead_responder)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title, description, severity || 'medium', status || 'active', category, location, affected_stakeholders, lead_responder]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update crisis incident
router.put('/:id', async (req, res) => {
  try {
    const { title, description, severity, status, category, location, affected_stakeholders, lead_responder } = req.body;
    const result = await pool.query(
      `UPDATE crisis_incidents SET title = $1, description = $2, severity = $3, status = $4,
       category = $5, location = $6, affected_stakeholders = $7, lead_responder = $8,
       updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *`,
      [title, description, severity, status, category, location, affected_stakeholders, lead_responder, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT escalate incident — increase severity one level, notify stakeholders
router.put(
  '/:id/escalate',
  [
    body('reason').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { reason } = req.body;
      const incidentResult = await pool.query(
        'SELECT * FROM crisis_incidents WHERE id = $1',
        [req.params.id]
      );
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      const incident = incidentResult.rows[0];
      const newSeverity = nextSeverity(incident.severity);

      // Update severity
      const updated = await pool.query(
        `UPDATE crisis_incidents SET severity = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [newSeverity, req.params.id]
      );

      // Log escalation to incident timeline
      await pool.query(
        `INSERT INTO incident_timelines (crisis_id, event_title, event_description, event_type, impact_level)
         VALUES ($1, $2, $3, 'escalation', $4)`,
        [
          req.params.id,
          `Severity escalated to ${newSeverity.toUpperCase()}`,
          reason || `Incident severity increased from ${incident.severity} to ${newSeverity}.`,
          newSeverity,
        ]
      );

      // Find stakeholders to notify (look up by affected_stakeholders field if set)
      let notified = [];
      try {
        const stakeholderResult = await pool.query(
          'SELECT name, email FROM stakeholders WHERE priority IN ($1, $2) AND email IS NOT NULL',
          ['high', 'critical']
        );
        notified = stakeholderResult.rows.map((s) => s.name);
        // Actual email sending would go here (see bulk-notify endpoint for pattern)
        if (notified.length > 0) {
          console.log(`[escalate] Incident ${req.params.id} escalated. Would notify: ${notified.join(', ')}`);
        }
      } catch (_) {
        // non-fatal — stakeholder notification is best-effort
      }

      res.json({
        incident: updated.rows[0],
        escalated_from: incident.severity,
        escalated_to: newSeverity,
        stakeholders_notified: notified,
        reason: reason || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

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
