const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateAIResponse } = require('../services/openrouter');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const pool = require('../db/pool');

const SYSTEM_PROMPT =
  'You are an expert crisis communications specialist with deep knowledge of PR strategy, ' +
  'stakeholder management, and reputation recovery. Provide clear, measured, strategic communication guidance.';

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// ── POST /api/ai/crisis-statement ──────────────────────────────────────────
router.post(
  '/crisis-statement',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }).withMessage('incident_id must be a positive integer'),
    body('audience_type').notEmpty().withMessage('audience_type is required'),
    body('tone').notEmpty().withMessage('tone is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, audience_type, tone } = req.body;

      const incidentResult = await pool.query(
        'SELECT * FROM crisis_incidents WHERE id = $1',
        [incident_id]
      );
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      const incident = incidentResult.rows[0];

      const userPrompt = `
Generate an official crisis statement for the following situation:

Incident: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Category: ${incident.category || 'General'}
Status: ${incident.status}

Target Audience: ${audience_type}
Tone: ${tone}

Please produce:
1. An official crisis statement (2-3 paragraphs)
2. Three key messages to reinforce
3. What NOT to say (3 bullet points)
4. Suggested follow-up communication timeline

Format clearly with headings.`.trim();

      const content = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      res.json({ incident_id, audience_type, tone, statement: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/media-response ────────────────────────────────────────────
router.post(
  '/media-response',
  aiRateLimiter,
  [
    body('reporter_questions')
      .isArray({ min: 1 })
      .withMessage('reporter_questions must be a non-empty array'),
    body('incident_context').notEmpty().withMessage('incident_context is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { reporter_questions, incident_context } = req.body;

      const userPrompt = `
You are preparing a spokesperson for a press conference. Generate Q&A responses.

Incident Context: ${incident_context}

Reporter Questions:
${reporter_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each question provide:
- Recommended answer (concise, measured)
- Key message to reinforce
- What to avoid saying

Format each as a clear Q&A block.`.trim();

      const content = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      res.json({ question_count: reporter_questions.length, qa_responses: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/social-monitoring ────────────────────────────────────────
router.post(
  '/social-monitoring',
  aiRateLimiter,
  [
    body('brand_mentions').isArray({ min: 1 }).withMessage('brand_mentions must be a non-empty array'),
    body('period_hours').isInt({ min: 1 }).withMessage('period_hours must be a positive integer'),
  ],
  validate,
  async (req, res) => {
    try {
      const { brand_mentions, period_hours } = req.body;

      const userPrompt = `
Analyze the following brand mentions from the past ${period_hours} hours and provide a social media crisis assessment.

Brand Mentions (${brand_mentions.length} total):
${brand_mentions.map((m, i) => `${i + 1}. Platform: ${m.platform || 'Unknown'} | Sentiment: ${m.sentiment || 'Unknown'} | Reach: ${m.reach || 'N/A'} | Content: ${m.content || m}`).join('\n')}

Provide:
1. Overall Sentiment Trend (improving / stable / deteriorating)
2. Viral Risk Assessment (Low / Medium / High / Critical) with reasoning
3. Top 3 Themes or Narratives emerging
4. Recommended responses for the top 3 highest-risk mentions
5. Suggested hashtags or messaging to counter negative narratives
6. 24-hour action plan`.trim();

      const content = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      res.json({ period_hours, mention_count: brand_mentions.length, analysis: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/stakeholder-comms ────────────────────────────────────────
router.post(
  '/stakeholder-comms',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }).withMessage('incident_id must be a positive integer'),
    body('stakeholder_type')
      .isIn(['employees', 'investors', 'customers', 'regulators'])
      .withMessage('stakeholder_type must be one of: employees, investors, customers, regulators'),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, stakeholder_type } = req.body;

      const incidentResult = await pool.query(
        'SELECT * FROM crisis_incidents WHERE id = $1',
        [incident_id]
      );
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      const incident = incidentResult.rows[0];

      const audienceDetails = {
        employees: 'Internal staff and workforce. They need reassurance about job security, clear guidance on their role, and honest information.',
        investors: 'Shareholders and financial stakeholders. They need financial impact assessment, recovery confidence, and transparency.',
        customers: 'End users and clients. They need empathy, service continuity assurance, and compensation information if applicable.',
        regulators: 'Government bodies and regulatory agencies. They need compliance details, corrective actions, and timeline commitments.',
      };

      const userPrompt = `
Create tailored crisis communication for the following stakeholder group.

Incident: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Status: ${incident.status}

Stakeholder Group: ${stakeholder_type.toUpperCase()}
Audience Profile: ${audienceDetails[stakeholder_type]}

Generate:
1. Email subject line
2. Opening statement (2 sentences)
3. Core message body (3-4 paragraphs)
4. Specific actions being taken relevant to this audience
5. Next steps / what this group can expect
6. Closing statement
7. Suggested FAQ (3 questions with answers)`.trim();

      const content = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      res.json({ incident_id, stakeholder_type, communication: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/recovery-roadmap ─────────────────────────────────────────
router.post(
  '/recovery-roadmap',
  aiRateLimiter,
  [
    body('incident_id').isInt({ min: 1 }).withMessage('incident_id must be a positive integer'),
    body('current_phase').notEmpty().withMessage('current_phase is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { incident_id, current_phase } = req.body;

      const incidentResult = await pool.query(
        'SELECT * FROM crisis_incidents WHERE id = $1',
        [incident_id]
      );
      if (incidentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      const incident = incidentResult.rows[0];

      const userPrompt = `
Create a comprehensive crisis recovery roadmap.

Incident: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Category: ${incident.category || 'General'}
Current Phase: ${current_phase}

Generate a phase-by-phase recovery plan covering:

Phase 1 – Immediate Response (0-24 hours)
Phase 2 – Stabilization (1-7 days)
Phase 3 – Recovery (1-4 weeks)
Phase 4 – Reputation Rebuilding (1-6 months)
Phase 5 – Long-term Resilience (6+ months)

For each phase include:
- Key objectives
- Specific milestones (minimum 3)
- Success metrics / KPIs
- Communications focus
- Risks to watch

Also include an overall Recovery Confidence Score (1-10) and rationale.`.trim();

      const content = await generateAIResponse(SYSTEM_PROMPT, userPrompt);
      res.json({ incident_id, current_phase, roadmap: content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
