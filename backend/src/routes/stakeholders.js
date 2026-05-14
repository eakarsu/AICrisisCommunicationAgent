const express = require('express');
const router = express.Router();
const { body, query: qv, validationResult } = require('express-validator');
const pool = require('../db/pool');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ─── Individual Stakeholders (existing) ────────────────────────────────────

// GET all stakeholders (paginated)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM stakeholders ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM stakeholders'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
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
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
  ],
  validate,
  async (req, res) => {
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
  }
);

// PUT update stakeholder
router.put(
  '/:id',
  [body('email').optional().isEmail().withMessage('Invalid email format')],
  validate,
  async (req, res) => {
    try {
      const { name, organization, role, email, phone, priority, relationship, notes } = req.body;
      const result = await pool.query(
        `UPDATE stakeholders SET name = $1, organization = $2, role = $3, email = $4, phone = $5,
         priority = $6, relationship = $7, notes = $8 WHERE id = $9 RETURNING *`,
        [name, organization, role, email, phone, priority, relationship, notes, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE stakeholder
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM stakeholders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stakeholder Groups ─────────────────────────────────────────────────────

// GET all groups (paginated)
router.get('/groups/all', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM stakeholder_groups ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM stakeholder_groups'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET group by id
router.get('/groups/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stakeholder_groups WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create group
router.post(
  '/groups',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('type')
      .isIn(['employees', 'investors', 'customers', 'regulators', 'media', 'partners', 'other'])
      .withMessage('Invalid group type'),
    body('contact_list')
      .optional()
      .isArray()
      .withMessage('contact_list must be an array'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, type, contact_list, communication_preferences } = req.body;
      const result = await pool.query(
        `INSERT INTO stakeholder_groups (name, type, contact_list, communication_preferences)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          name,
          type,
          JSON.stringify(contact_list || []),
          JSON.stringify(communication_preferences || {}),
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update group
router.put(
  '/groups/:id',
  [
    body('contact_list').optional().isArray().withMessage('contact_list must be an array'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, type, contact_list, communication_preferences } = req.body;
      const result = await pool.query(
        `UPDATE stakeholder_groups
         SET name = COALESCE($1, name),
             type = COALESCE($2, type),
             contact_list = COALESCE($3, contact_list),
             communication_preferences = COALESCE($4, communication_preferences),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [
          name || null,
          type || null,
          contact_list ? JSON.stringify(contact_list) : null,
          communication_preferences ? JSON.stringify(communication_preferences) : null,
          req.params.id,
        ]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE group
router.delete('/groups/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM stakeholder_groups WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /groups/bulk-notify — send email to entire stakeholder group
router.post(
  '/groups/bulk-notify',
  [
    body('group_id').isInt({ min: 1 }).withMessage('group_id must be a positive integer'),
    body('subject').notEmpty().withMessage('subject is required'),
    body('message').notEmpty().withMessage('message is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { group_id, subject, message } = req.body;

      const groupResult = await pool.query(
        'SELECT * FROM stakeholder_groups WHERE id = $1',
        [group_id]
      );
      if (groupResult.rows.length === 0) {
        return res.status(404).json({ error: 'Stakeholder group not found' });
      }
      const group = groupResult.rows[0];

      let contactList = group.contact_list;
      if (typeof contactList === 'string') {
        try { contactList = JSON.parse(contactList); } catch (_) { contactList = []; }
      }
      if (!Array.isArray(contactList)) contactList = [];

      const emails = contactList
        .map((c) => (typeof c === 'string' ? c : c.email))
        .filter(Boolean);

      if (emails.length === 0) {
        return res.status(400).json({ error: 'No email addresses found in this group' });
      }

      let sent = 0;
      let skipped = 0;

      if (!nodemailer || !process.env.SMTP_HOST) {
        // Gracefully skip sending — log the notification instead
        console.log(`[bulk-notify] SMTP not configured. Would have sent to: ${emails.join(', ')}`);
        skipped = emails.length;
      } else {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        for (const email of emails) {
          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: email,
              subject,
              text: message,
            });
            sent++;
          } catch (emailErr) {
            console.warn(`[bulk-notify] Failed to send to ${email}: ${emailErr.message}`);
            skipped++;
          }
        }
      }

      res.json({
        group_id,
        group_name: group.name,
        total_contacts: emails.length,
        sent,
        skipped,
        message: `Notification dispatched to ${sent} contact(s). ${skipped} skipped.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
