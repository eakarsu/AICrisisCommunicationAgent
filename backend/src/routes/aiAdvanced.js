/**
 * Advanced AI endpoints — implements audit-proposed NEW custom non-CRUD features
 * for the Crisis Communication Agent. Each endpoint persists structured results
 * to ai_results JSONB for replay / audit / dashboards.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { generateAIResponse, parseAIJson } = require('../services/openrouter');
const { aiRateLimiter } = require('../middleware/rateLimiter');

const SYSTEM_PROMPT =
  'You are an expert crisis communications strategist. Be measured, factual, and audit-friendly. Return STRICT JSON when asked.';

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

async function persistAIResult({ endpoint, entityType, entityId, userId, raw, parsed, model }) {
  try {
    await pool.query(
      `INSERT INTO ai_results (endpoint, entity_type, entity_id, user_id, model, result)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [endpoint, entityType || null, entityId || null, userId || null, model || null, JSON.stringify({ raw, parsed })]
    );
  } catch (e) {
    console.error('[ai_results.insert]', e.message);
  }
}

// ── 1. Sentiment Trend Dashboard ─────────────────────────────────────────────
// GET /api/ai-advanced/sentiment-trend?incident_id=&hours=24
router.get('/sentiment-trend', async (req, res) => {
  try {
    const incident_id = parseInt(req.query.incident_id) || null;
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours) || 24));

    const where = incident_id ? 'WHERE incident_id = $1 AND bucket_at >= NOW() - ($2 || \' hours\')::interval' : 'WHERE bucket_at >= NOW() - ($1 || \' hours\')::interval';
    const params = incident_id ? [incident_id, String(hours)] : [String(hours)];

    const trend = await pool.query(
      `SELECT bucket_at, AVG(avg_sentiment) AS sentiment, SUM(volume) AS volume, source
         FROM sentiment_trend ${where}
         GROUP BY bucket_at, source ORDER BY bucket_at ASC`,
      params
    );

    // Compute simple alert: 3 consecutive negative buckets below -0.3
    const flat = trend.rows.map((r) => parseFloat(r.sentiment));
    let alertLevel = 'green';
    let consec = 0;
    for (const s of flat) {
      if (s < -0.3) consec++; else consec = 0;
      if (consec >= 3) { alertLevel = 'red'; break; }
      if (consec === 2) alertLevel = 'amber';
    }

    res.json({
      incident_id,
      hours,
      buckets: trend.rows,
      alert_level: alertLevel,
      summary: {
        bucket_count: trend.rows.length,
        avg_sentiment: flat.length ? (flat.reduce((s, n) => s + n, 0) / flat.length).toFixed(3) : 0,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ai-advanced/sentiment-trend/ingest — record a sentiment bucket
router.post(
  '/sentiment-trend/ingest',
  [
    body('incident_id').optional().isInt(),
    body('avg_sentiment').isFloat({ min: -1, max: 1 }),
    body('volume').optional().isInt({ min: 0 }),
    body('source').optional().isString(),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, avg_sentiment, volume = 0, source = 'unknown' } = req.body;
      const r = await pool.query(
        `INSERT INTO sentiment_trend (incident_id, bucket_at, avg_sentiment, volume, source)
           VALUES ($1, NOW(), $2, $3, $4) RETURNING *`,
        [incident_id || null, avg_sentiment, volume, source]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 2. Automated Media Alerts ────────────────────────────────────────────────
// POST /api/ai-advanced/media-alert { incident_id, mention_text }
router.post(
  '/media-alert',
  aiRateLimiter,
  [
    body('mention_text').notEmpty(),
    body('incident_id').optional().isInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { mention_text, incident_id } = req.body;
      const userPrompt = `A new media mention has been detected. Classify it for crisis response.

Mention: "${mention_text}"

Return STRICT JSON: {
  "is_relevant": true,
  "sentiment_label": "positive|negative|neutral|mixed",
  "sentiment_score": -1,
  "topics": [],
  "alert_severity": "low|medium|high|critical",
  "suggested_action": "monitor|prepare_response|publish_statement|escalate",
  "spokesperson_brief": ""
}`;

      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'media-alert', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });

      res.json({ incident_id, mention_text, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 3. Stakeholder Notification Cascade ──────────────────────────────────────
// POST /api/ai-advanced/notification-cascade { incident_id, message_template }
router.post(
  '/notification-cascade',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }),
    body('message_template').notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, message_template } = req.body;

      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const stk = await pool.query('SELECT * FROM stakeholders ORDER BY priority ASC');
      const tiers = { primary: [], secondary: [], tertiary: [] };
      for (const s of stk.rows) {
        const p = s.priority || 'secondary';
        if (tiers[p]) tiers[p].push({ id: s.id, name: s.name, email: s.email, role: s.role });
      }

      const userPrompt = `Personalize the following message template for each stakeholder tier (primary/secondary/tertiary). Higher tier = more detail and earlier delivery.

Incident: ${incident.title}
Severity: ${incident.severity}
Template: """${message_template}"""

Tier counts: primary=${tiers.primary.length}, secondary=${tiers.secondary.length}, tertiary=${tiers.tertiary.length}

Return STRICT JSON: {
  "tiers": {
    "primary":   { "subject": "", "body": "", "send_within_minutes": 5 },
    "secondary": { "subject": "", "body": "", "send_within_minutes": 30 },
    "tertiary":  { "subject": "", "body": "", "send_within_minutes": 120 }
  }
}`;

      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || { tiers: {} };

      const totalRecipients = tiers.primary.length + tiers.secondary.length + tiers.tertiary.length;
      const cascade = await pool.query(
        `INSERT INTO notification_cascades (incident_id, tier_payload, sent_count, failed_count)
         VALUES ($1, $2, $3, 0) RETURNING *`,
        [incident_id, JSON.stringify({ tiers, generated: parsed.tiers }), totalRecipients]
      );

      await persistAIResult({ endpoint: 'notification-cascade', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });

      res.status(201).json({
        cascade: cascade.rows[0],
        tiers,
        generated_messages: parsed.tiers,
        recipients_total: totalRecipients,
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// GET /api/ai-advanced/notification-cascade — paginated history
router.get('/notification-cascade', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM notification_cascades ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM notification_cascades'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 4. Crisis Severity Scorer ────────────────────────────────────────────────
// POST /api/ai-advanced/severity-score { incident_id }
router.post(
  '/severity-score',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { incident_id } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const userPrompt = `Score this incident's crisis severity from 0-10 and recommend escalation if >=8.

Incident: ${incident.title}
Description: ${incident.description}
Current severity tag: ${incident.severity}
Affected stakeholders: ${incident.affected_stakeholders || 'unknown'}

Return STRICT JSON: {
  "severity_score": 0,
  "exec_escalation_recommended": false,
  "drivers": [],
  "estimated_impact_radius": "local|regional|national|global",
  "recommended_response_window_hours": 0
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};

      // Auto-escalate severity if score >= 8
      if (parsed.severity_score >= 8 && (incident.severity !== 'critical')) {
        await pool.query('UPDATE crisis_incidents SET severity = $1 WHERE id = $2', ['critical', incident_id]);
        await pool.query(
          `INSERT INTO incident_timelines (crisis_id, event_title, event_description, event_type, impact_level)
           VALUES ($1, 'AI Auto-Escalation', $2, 'escalation', 'critical')`,
          [incident_id, `AI severity scorer rated ${parsed.severity_score}/10. Auto-escalated to critical.`]
        );
      }

      await persistAIResult({ endpoint: 'severity-score', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 5. Message Consistency Checker ───────────────────────────────────────────
// POST /api/ai-advanced/consistency-check { incident_id }
router.post(
  '/consistency-check',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { incident_id } = req.body;

      const [tp, pr, sm] = await Promise.all([
        pool.query('SELECT * FROM talking_points WHERE crisis_id = $1', [incident_id]),
        pool.query('SELECT * FROM press_releases WHERE crisis_id = $1', [incident_id]),
        pool.query('SELECT * FROM social_media_responses WHERE crisis_id = $1', [incident_id]).catch(() => ({ rows: [] })),
      ]);

      const userPrompt = `Check the following crisis communications for messaging consistency. Flag contradictions or tone mismatches.

Talking points (${tp.rows.length}):
${tp.rows.map((t) => `- [${t.target_audience}] ${t.points || ''}`).join('\n') || 'none'}

Press releases (${pr.rows.length}):
${pr.rows.map((p) => `- ${p.title}: ${(p.content || '').slice(0, 200)}`).join('\n') || 'none'}

Social posts (${sm.rows.length}):
${sm.rows.map((s) => `- [${s.platform}] ${(s.message || '').slice(0, 200)}`).join('\n') || 'none'}

Return STRICT JSON: {
  "consistency_score": 0,
  "consistent": true,
  "contradictions": [],
  "tone_mismatches": [],
  "recommended_corrections": [],
  "ready_to_publish": true
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'consistency-check', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, talking_points: tp.rows.length, press_releases: pr.rows.length, social_posts: sm.rows.length, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 6. Response Template Recommender ─────────────────────────────────────────
// POST /api/ai-advanced/template-recommender { incident_id }
router.post(
  '/template-recommender',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { incident_id } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const tmpl = await pool.query('SELECT id, name, category, tone, use_case FROM response_templates ORDER BY last_used DESC NULLS LAST LIMIT 25');

      const userPrompt = `Recommend the top 3 response templates for this crisis from the catalog. Rank by historical effectiveness and topical fit.

Incident:
- Title: ${incident.title}
- Category: ${incident.category || 'general'}
- Severity: ${incident.severity}
- Description: ${incident.description}

Catalog (${tmpl.rows.length}):
${tmpl.rows.map((t) => `${t.id}: ${t.name} | category=${t.category || 'general'} | tone=${t.tone || 'neutral'} | use_case=${t.use_case || 'general'}`).join('\n')}

Return STRICT JSON: {
  "recommendations": [{ "template_id": 0, "score": 0, "reason": "" }],
  "best_template_id": 0,
  "rationale": ""
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'template-recommender', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 7. Impact Forecaster ─────────────────────────────────────────────────────
// POST /api/ai-advanced/impact-forecast { incident_id }
router.post(
  '/impact-forecast',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { incident_id } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const media = await pool.query('SELECT COUNT(*) FROM media_monitoring WHERE incident_id = $1', [incident_id]).catch(() => ({ rows: [{ count: 0 }] }));

      const userPrompt = `Predict crisis duration, financial impact (USD), and reputation impact for this incident.

Incident: ${incident.title}
Severity: ${incident.severity}
Description: ${incident.description}
Media mentions logged: ${media.rows[0].count}

Return STRICT JSON: {
  "duration_days_low": 0, "duration_days_likely": 0, "duration_days_high": 0,
  "financial_impact_usd_low": 0, "financial_impact_usd_likely": 0, "financial_impact_usd_high": 0,
  "reputation_impact_score_0_100": 0,
  "stock_price_impact_pct": 0,
  "key_drivers": [],
  "confidence_pct": 0
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'impact-forecast', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 8. Competitor Mention Tracker ────────────────────────────────────────────
// POST /api/ai-advanced/competitor-mentions { incident_id, competitor_names: [...] }
router.post(
  '/competitor-mentions',
  aiRateLimiter,
  [
    body('competitor_names').isArray({ min: 1 }),
    body('incident_id').optional().isInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, competitor_names } = req.body;
      const recent = await pool.query(
        `SELECT title, source, sentiment, summary FROM media_monitoring
         WHERE created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 50`
      );

      const userPrompt = `Identify whether competitors are benefiting from our crisis. Flag opportunistic messaging.

Competitors: ${competitor_names.join(', ')}

Recent media coverage (${recent.rows.length} items):
${recent.rows.slice(0, 25).map((m) => `- ${m.source}: ${m.title} | sentiment=${m.sentiment || 'unk'}`).join('\n') || 'none'}

Return STRICT JSON: {
  "competitor_activity": [{ "name": "", "mention_count": 0, "tone": "neutral|opportunistic|sympathetic", "examples": [] }],
  "opportunistic_messaging_detected": false,
  "recommended_counter_messaging": [],
  "monitoring_priority": "low|medium|high"
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'competitor-mentions', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, competitor_names, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 9. Draft Press Release ───────────────────────────────────────────────────
// POST /api/ai-advanced/draft-press-release { incident_id, audience? }
function aiKeyMissing() {
  const k = process.env.OPENROUTER_API_KEY;
  return !k || k === 'your-openrouter-key-here' || k === 'your_openrouter_key_here';
}
router.post(
  '/draft-press-release',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 }), body('audience').optional().isString()],
  validate,
  async (req, res) => {
    try {
      if (aiKeyMissing()) return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured.' });
      const { incident_id, audience = 'general public' } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const userPrompt = `Draft a publication-ready press release for the following incident.

Incident: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Category: ${incident.category || 'general'}
Audience: ${audience}

Return STRICT JSON: {
  "headline": "",
  "subheadline": "",
  "body_paragraphs": [],
  "spokesperson_quote": "",
  "boilerplate": "",
  "media_contact_block": "",
  "embargo_recommended_until": null
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'draft-press-release', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, audience, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 10. Predict Escalation ───────────────────────────────────────────────────
// POST /api/ai-advanced/predict-escalation { incident_id }
router.post(
  '/predict-escalation',
  aiRateLimiter,
  [body('incident_id').isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      if (aiKeyMissing()) return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured.' });
      const { incident_id } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const media = await pool.query(
        `SELECT title, source, sentiment FROM media_monitoring
         WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 25`,
        [incident_id]
      ).catch(() => ({ rows: [] }));

      const userPrompt = `Predict whether this crisis is likely to escalate in the next 24/48/72 hours.

Incident: ${incident.title}
Severity: ${incident.severity}
Description: ${incident.description}
Recent media (${media.rows.length}):
${media.rows.map((m) => `- ${m.source}: ${m.title} | sentiment=${m.sentiment || 'unk'}`).join('\n') || 'none'}

Return STRICT JSON: {
  "escalation_probability_24h": 0,
  "escalation_probability_48h": 0,
  "escalation_probability_72h": 0,
  "leading_indicators": [],
  "recommended_proactive_actions": [],
  "trigger_thresholds": [],
  "confidence_pct": 0
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'predict-escalation', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 11. Auto-Generate Talking Points ─────────────────────────────────────────
// POST /api/ai-advanced/auto-generate-talking-points { incident_id, audiences? }
router.post(
  '/auto-generate-talking-points',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }),
    body('audiences').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      if (aiKeyMissing()) return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured.' });
      const { incident_id, audiences = ['employees', 'media', 'customers', 'investors'] } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      const userPrompt = `Auto-generate concise talking points for each audience.

Incident: ${incident.title}
Severity: ${incident.severity}
Description: ${incident.description}
Audiences: ${audiences.join(', ')}

Return STRICT JSON: {
  "talking_points": [
    { "audience": "", "key_messages": [], "supporting_facts": [], "avoid_phrases": [] }
  ],
  "shared_themes": [],
  "tone": ""
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'auto-generate-talking-points', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, audiences, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── 12. Recommend Tactics ────────────────────────────────────────────────────
// POST /api/ai-advanced/recommend-tactics { incident_id, stakeholder_ids? }
router.post(
  '/recommend-tactics',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }),
    body('stakeholder_ids').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      if (aiKeyMissing()) return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured.' });
      const { incident_id, stakeholder_ids } = req.body;
      const inc = await pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]);
      if (inc.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const incident = inc.rows[0];

      let stakeholders = [];
      if (Array.isArray(stakeholder_ids) && stakeholder_ids.length > 0) {
        const ids = stakeholder_ids.map((x) => parseInt(x)).filter((n) => !Number.isNaN(n));
        if (ids.length > 0) {
          const r = await pool.query('SELECT id, name, role, priority FROM stakeholders WHERE id = ANY($1::int[])', [ids]);
          stakeholders = r.rows;
        }
      } else {
        const r = await pool.query('SELECT id, name, role, priority FROM stakeholders ORDER BY priority ASC LIMIT 25').catch(() => ({ rows: [] }));
        stakeholders = r.rows;
      }

      const userPrompt = `Build a tactical playbook for the incident, including channel and sequencing per stakeholder group.

Incident: ${incident.title}
Severity: ${incident.severity}
Description: ${incident.description}
Stakeholders (${stakeholders.length}):
${stakeholders.map((s) => `- #${s.id} ${s.name} (${s.role || 'n/a'}, priority=${s.priority || 'secondary'})`).join('\n') || 'none'}

Return STRICT JSON: {
  "tactics": [
    { "name": "", "objective": "", "channel": "", "owner_role": "", "deadline_hours": 0, "stakeholder_targets": [], "success_metric": "" }
  ],
  "sequencing_notes": "",
  "risk_callouts": [],
  "fallback_tactics": []
}`;
      const raw = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      const parsed = parseAIJson(raw) || {};
      await persistAIResult({ endpoint: 'recommend-tactics', entityType: 'crisis_incident', entityId: incident_id, raw, parsed });
      res.json({ incident_id, stakeholders_considered: stakeholders.length, ...parsed, raw });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── GET /api/ai-advanced/results — paginated AI audit log ────────────────────
router.get('/results', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const filters = []; const params = [];
    if (req.query.endpoint) { params.push(req.query.endpoint); filters.push(`endpoint = $${params.length}`); }
    if (req.query.entity_id) { params.push(parseInt(req.query.entity_id)); filters.push(`entity_id = $${params.length}`); }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
    params.push(limit); params.push(offset);

    const data = await pool.query(`SELECT * FROM ai_results ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const count = await pool.query(`SELECT COUNT(*) FROM ai_results ${where}`, params.slice(0, params.length - 2));
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
