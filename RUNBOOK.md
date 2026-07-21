# Governed crisis publishing runbook

Install and migrate explicitly with `scripts/`; `start.sh` only starts installed services and stops its own children. It never truncates data, seeds, starts PostgreSQL, or kills arbitrary listeners. Production secrets must be generated and rotated from `.env.example`.

The governed migration separates verified incidents and authoritative source digests from audience/channel message versions, accessibility and consistency evidence, incident-command and communications approvals, provider outbox attempts, acknowledgements, corrections, and audit events. Generated `gap_*` endpoints are not mounted. No model output can autonomously publish; external status/email/SMS/social/contact/media adapters must produce durable delivery receipts and failures.

Before production: contract-test adapters and contact-directory authority, rehearse partial delivery/dead-letter/correction paths, measure timeliness and cross-channel consistency, test accessibility, protect contact data, and complete incident-command/legal/privacy/security approval. Never use unverified media-monitoring content as publication authority.
