# Audit Apply Notes — AICrisisCommunicationAgent

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_02.md` (lines 570-601).

The audit reports `has_ai_route=0`, but inspection shows 16+ AI endpoints
between `routes/ai.js` (6) and `routes/aiAdvanced.js` (10+). The audit's "no
AI endpoints" claim appears to be a metadata error.

Per apply-pass policy (>15 AI endpoints → backlog-only), this pass is
**backlog-only** to avoid duplicating endpoints that may already exist under
slightly different names.

## Original audit recommendations

### Missing AI counterparts (audit claim, may be partly satisfied already)
- `/generate-response`, `/analyze-sentiment`, `/monitor-media`,
  `/draft-press-release`, `/simulate-crisis`, `/predict-escalation`,
  `/recommend-tactics`, `/analyze-stakeholder-sentiment`,
  `/auto-generate-talking-points`.
- Inspection of `aiAdvanced.js` suggests several of these may already
  exist (sentiment-trend, notification-cascade, etc.).

### Missing non-AI features
- Real-time alert system for crisis detection.
- Media-monitoring API integration (Meltwater, Brandwatch).
- Email/SMS/push notification distribution.
- Approval workflow for crisis responses.

### Custom feature suggestions
- Predictive crisis detection.
- Agentic response planning.
- Sentiment-driven escalation.
- Scenario stress testing.
- Post-crisis learning automation.

## Implemented in this pass

None. Backlog-only per substantive-project policy and to avoid duplicating
endpoints that already exist.

## Backlog (prioritized)

### Mechanical, low-risk (audit gaps to verify against existing code)
1. Verify whether `/draft-press-release`, `/predict-escalation`, and
   `/auto-generate-talking-points` exist; if not, add stateless wrappers in
   `aiAdvanced.js`.
2. Add `/recommend-tactics` endpoint that takes incident + stakeholders and
   returns a tactical playbook.

### Needs product decision
- Real-time crisis-detection feed design.
- Approval-workflow data model.

### Needs credentials / external SDK
- Meltwater / Brandwatch / X / Reddit monitoring.
- Email/SMS/push (SendGrid, Twilio, FCM).

### Too risky / large refactor
- Multi-channel autonomous response system (legal/compliance review needed).

## Apply pass 3 (frontend)

LEFT-AS-IS. Frontend already wires the AI endpoints implemented in apply pass 2 (JWT Bearer auth from localStorage, 503-no-key handling via backend, existing styling). No changes required.

## Apply pass 4 (mechanical backlog)

NO CHANGES. All mechanical backlog endpoints (`/draft-press-release`, `/predict-escalation`, `/auto-generate-talking-points`, `/recommend-tactics`) are already implemented in `routes/aiAdvanced.js` and wired in `pages/AIAdvanced.js` from prior passes. Verified by grep. Remaining backlog items are NEEDS-CREDS or NEEDS-PRODUCT-DECISION (real-time crisis feed, approval workflow, Meltwater/Twilio/SendGrid integrations).
