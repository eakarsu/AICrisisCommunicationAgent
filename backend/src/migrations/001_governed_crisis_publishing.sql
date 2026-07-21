BEGIN;
CREATE TABLE IF NOT EXISTS governed_crisis_incidents (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  incident_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('monitoring','minor','major','critical')),
  verification_state TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified','partially_verified','verified','disputed','resolved')),
  commander_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','active','contained','resolved','closed')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,idempotency_key), UNIQUE (tenant_id,incident_key)
);
CREATE TABLE IF NOT EXISTS crisis_authoritative_sources (
  id UUID PRIMARY KEY, incident_id UUID NOT NULL REFERENCES governed_crisis_incidents(id), tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('incident_system','official','subject_matter_expert','sensor','media_monitoring')),
  source_uri TEXT NOT NULL, sha256 CHAR(64) NOT NULL, verified_by TEXT NOT NULL, verified_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ, UNIQUE (incident_id,sha256)
);
CREATE TABLE IF NOT EXISTS crisis_message_versions (
  id UUID PRIMARY KEY, incident_id UUID NOT NULL REFERENCES governed_crisis_incidents(id), tenant_id TEXT NOT NULL,
  parent_version_id UUID REFERENCES crisis_message_versions(id), version_number INTEGER NOT NULL, audience_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('status_page','email','sms','social','press','internal')),
  body TEXT NOT NULL, source_citations JSONB NOT NULL, accessibility_evaluation JSONB NOT NULL,
  consistency_key TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','review','approved','scheduled','published','superseded','withdrawn')),
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (incident_id,audience_key,channel,version_number)
);
CREATE TABLE IF NOT EXISTS crisis_message_approvals (
  id BIGSERIAL PRIMARY KEY, message_version_id UUID NOT NULL REFERENCES crisis_message_versions(id), tenant_id TEXT NOT NULL,
  gate TEXT NOT NULL CHECK (gate IN ('incident_command','communications','legal','accessibility')),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')), rationale TEXT NOT NULL,
  actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crisis_delivery_outbox (
  id UUID PRIMARY KEY, message_version_id UUID NOT NULL REFERENCES crisis_message_versions(id), tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL, recipient_segment TEXT NOT NULL, idempotency_key TEXT NOT NULL, scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','partially_delivered','failed','dead_letter','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0, accepted_count INTEGER, failed_count INTEGER, last_error_code TEXT,
  provider_reference TEXT, next_attempt_at TIMESTAMPTZ, UNIQUE (tenant_id,provider,idempotency_key)
);
CREATE TABLE IF NOT EXISTS crisis_acknowledgements (
  id UUID PRIMARY KEY, delivery_id UUID NOT NULL REFERENCES crisis_delivery_outbox(id), tenant_id TEXT NOT NULL,
  recipient_reference TEXT NOT NULL, acknowledged_at TIMESTAMPTZ NOT NULL, UNIQUE (delivery_id,recipient_reference)
);
CREATE TABLE IF NOT EXISTS crisis_corrections (
  id UUID PRIMARY KEY, incident_id UUID NOT NULL REFERENCES governed_crisis_incidents(id), tenant_id TEXT NOT NULL,
  superseded_message_id UUID NOT NULL REFERENCES crisis_message_versions(id), replacement_message_id UUID NOT NULL REFERENCES crisis_message_versions(id),
  reason TEXT NOT NULL, approved_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS crisis_audit_events (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, incident_id UUID NOT NULL REFERENCES governed_crisis_incidents(id),
  actor_id TEXT NOT NULL, action TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_incident_tenant_state ON governed_crisis_incidents(tenant_id,state);
CREATE INDEX IF NOT EXISTS idx_crisis_delivery_retry ON crisis_delivery_outbox(status,next_attempt_at);
COMMIT;
