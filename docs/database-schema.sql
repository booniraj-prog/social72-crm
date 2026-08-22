-- Social72 CRM — proposed PostgreSQL schema
-- UUIDs as PKs. Amounts NUMERIC(14,2). Timestamps timestamptz.
-- Duplicate uniqueness: unique (client_id, mobile_e164) where deleted_at is null.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE, -- super_admin, crm_manager, bpo_leader, bpo_executive, marketing_manager, client
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE, -- e.g. lead.read, lead.assign
  description   TEXT
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES roles(id),
  client_id       UUID, -- only for future Client portal users
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT, -- managed by Better Auth; may live in auth tables instead
  full_name       TEXT NOT NULL,
  mobile          TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  leader_id     UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- Better Auth session/account tables will be added by the library.

-- ---------------------------------------------------------------------------
-- Clients, industries, campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE industries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE, -- education, real_estate
  name          TEXT NOT NULL
);

CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  industry_id   UUID REFERENCES industries(id),
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id),
  industry_id     UUID NOT NULL REFERENCES industries(id),
  pipeline_id     UUID, -- FK added after pipelines
  name            TEXT NOT NULL,
  campaign_type   TEXT,
  platform        TEXT, -- google_ads, meta_ads, linkedin, website, landing_page, organic, referral, other
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_spend    NUMERIC(14,2) NOT NULL DEFAULT 0,
  owner_user_id   UUID REFERENCES users(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_client ON campaigns(client_id);

CREATE TABLE campaign_managers (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  platform      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE marketing_spend (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  spend_date    DATE NOT NULL,
  platform      TEXT,
  amount        NUMERIC(14,2) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Configurable workflow
-- ---------------------------------------------------------------------------

CREATE TABLE pipelines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id   UUID NOT NULL REFERENCES industries(id),
  name          TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_pipeline_fk FOREIGN KEY (pipeline_id) REFERENCES pipelines(id);

CREATE TABLE lead_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT NOT NULL DEFAULT '#64748b',
  is_final      BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE status_transitions (
  from_status_id UUID NOT NULL REFERENCES lead_statuses(id) ON DELETE CASCADE,
  to_status_id   UUID NOT NULL REFERENCES lead_statuses(id) ON DELETE CASCADE,
  PRIMARY KEY (from_status_id, to_status_id)
);

CREATE TABLE pipeline_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status_id     UUID NOT NULL REFERENCES lead_statuses(id),
  name          TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE dispositions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE scoring_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key     TEXT NOT NULL UNIQUE, -- interested, not_interested, visit_completed, …
  points        INT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE sla_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE, -- assign_new_lead, first_call
  name            TEXT NOT NULL,
  threshold_minutes INT NOT NULL,
  escalate_to     TEXT, -- team_leader, manager
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

CREATE TABLE leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number           TEXT NOT NULL UNIQUE, -- human ID e.g. S72-2026-000123
  client_id             UUID NOT NULL REFERENCES clients(id),
  campaign_id           UUID NOT NULL REFERENCES campaigns(id),
  industry_id           UUID NOT NULL REFERENCES industries(id),
  source_id             UUID REFERENCES lead_sources(id),
  status_id             UUID NOT NULL REFERENCES lead_statuses(id),
  assigned_user_id      UUID REFERENCES users(id),
  assigned_team_id      UUID REFERENCES teams(id),
  created_by_id         UUID REFERENCES users(id),

  first_name            TEXT,
  last_name             TEXT,
  full_name             TEXT NOT NULL,
  mobile_e164           TEXT NOT NULL,
  alternate_mobile      TEXT,
  email                 TEXT,
  city                  TEXT,
  state                 TEXT,
  country               TEXT DEFAULT 'India',
  pincode               TEXT,
  age                   INT,
  gender                TEXT,
  occupation            TEXT,

  source_platform       TEXT,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  utm_term              TEXT,
  ad_id                 TEXT,
  ad_set                TEXT,
  landing_page          TEXT,
  generated_at          TIMESTAMPTZ,

  temperature           TEXT NOT NULL DEFAULT 'WARM' CHECK (temperature IN ('HOT','WARM','COLD','UNQUALIFIED')),
  lead_score            INT NOT NULL DEFAULT 0,
  assigned_at           TIMESTAMPTZ,
  first_contact_at      TIMESTAMPTZ,
  last_contact_at       TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  next_followup_at      TIMESTAMPTZ,
  next_action           TEXT,
  call_attempts         INT NOT NULL DEFAULT 0,
  connected_calls       INT NOT NULL DEFAULT 0,
  followup_count        INT NOT NULL DEFAULT 0,
  last_disposition_id   UUID REFERENCES dispositions(id),

  expected_value        NUMERIC(14,2) NOT NULL DEFAULT 0,
  probability_pct       INT NOT NULL DEFAULT 0 CHECK (probability_pct BETWEEN 0 AND 100),
  expected_revenue      NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_revenue        NUMERIC(14,2) NOT NULL DEFAULT 0,
  closure_date          DATE,
  closure_type          TEXT,
  won_lost_reason       TEXT,

  sla_assign_due_at     TIMESTAMPTZ,
  sla_first_call_due_at TIMESTAMPTZ,
  sla_assign_breached   BOOLEAN NOT NULL DEFAULT false,
  sla_first_call_breached BOOLEAN NOT NULL DEFAULT false,

  converted             BOOLEAN NOT NULL DEFAULT false,
  duplicate_of_id       UUID REFERENCES leads(id),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_leads_client_mobile_active
  ON leads (client_id, mobile_e164)
  WHERE deleted_at IS NULL AND duplicate_of_id IS NULL;

CREATE INDEX idx_leads_email ON leads (email);
CREATE INDEX idx_leads_client ON leads (client_id);
CREATE INDEX idx_leads_campaign ON leads (campaign_id);
CREATE INDEX idx_leads_assigned ON leads (assigned_user_id);
CREATE INDEX idx_leads_status ON leads (status_id);
CREATE INDEX idx_leads_followup ON leads (next_followup_at);
CREATE INDEX idx_leads_created ON leads (created_at);
CREATE INDEX idx_leads_full_name_trgm ON leads USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_leads_mobile ON leads (mobile_e164);

CREATE TABLE education_details (
  lead_id               UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  student_name          TEXT,
  parent_name           TEXT,
  current_class         TEXT,
  completed_class       TEXT,
  target_class          TEXT,
  board                 TEXT,
  course                TEXT,
  stream                TEXT,
  preferred_course      TEXT,
  entrance_exam         TEXT,
  academic_score        TEXT,
  location              TEXT,
  preferred_campus      TEXT,
  hostel_required       BOOLEAN,
  parent_occupation     TEXT,
  budget                NUMERIC(14,2),
  admission_timeline    TEXT,
  campus_visit_date     DATE,
  counselling_date      DATE,
  admission_status      TEXT,
  fee                   NUMERIC(14,2),
  scholarship           NUMERIC(14,2),
  payment_status        TEXT
);

CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id),
  name          TEXT NOT NULL,
  location      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  name          TEXT NOT NULL,
  property_type TEXT,
  configuration TEXT,
  location      TEXT,
  value         NUMERIC(14,2)
);

CREATE TABLE real_estate_details (
  lead_id                     UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  property_id                 UUID REFERENCES properties(id),
  project_id                  UUID REFERENCES projects(id),
  location                    TEXT,
  property_type               TEXT,
  configuration               TEXT,
  budget                      NUMERIC(14,2),
  preferred_location          TEXT,
  purpose                     TEXT,
  use_type                    TEXT, -- investment / end_use
  possession_requirement      TEXT,
  loan_required               BOOLEAN,
  site_visit_date             DATE,
  site_visit_status           TEXT,
  negotiation_status          TEXT,
  booking_amount              NUMERIC(14,2),
  expected_registration_date  DATE,
  registration_status         TEXT,
  property_value              NUMERIC(14,2)
);

CREATE TABLE lead_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_user_id  UUID REFERENCES users(id),
  to_user_id    UUID NOT NULL REFERENCES users(id),
  assigned_by   UUID REFERENCES users(id),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_score_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rule_id       UUID REFERENCES scoring_rules(id),
  points        INT NOT NULL,
  reason        TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Activity, calling, follow-ups
-- ---------------------------------------------------------------------------

CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  type          TEXT NOT NULL, -- created, assigned, call, status, note, followup, visit, merge, …
  title         TEXT NOT NULL,
  body          TEXT,
  ref_table     TEXT,
  ref_id        UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_lead ON activities (lead_id, created_at);

CREATE TABLE call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_sec    INT,
  disposition_id  UUID REFERENCES dispositions(id),
  notes           TEXT,
  next_followup_at TIMESTAMPTZ,
  next_action     TEXT,
  provider        TEXT, -- future telephony
  provider_call_id TEXT,
  recording_url   TEXT
);

CREATE INDEX idx_call_logs_lead ON call_logs (lead_id, started_at);
CREATE INDEX idx_call_logs_user ON call_logs (user_id, started_at);

CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follow_ups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  due_at        TIMESTAMPTZ NOT NULL,
  action        TEXT,
  completed_at  TIMESTAMPTZ,
  completed_by  UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followups_due ON follow_ups (due_at) WHERE completed_at IS NULL;
CREATE INDEX idx_followups_user ON follow_ups (user_id, due_at);

CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to   UUID REFERENCES users(id),
  title         TEXT NOT NULL,
  due_at        TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campus_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  campus        TEXT,
  outcome       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id   UUID REFERENCES properties(id),
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  outcome       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE opportunities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name          TEXT,
  value         NUMERIC(14,2),
  stage         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  paid_at       DATE,
  method        TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE closures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('WON','LOST')),
  amount        NUMERIC(14,2),
  reason        TEXT,
  closed_at     DATE NOT NULL,
  closed_by     UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Imports, notifications, audit, saved filters
-- ---------------------------------------------------------------------------

CREATE TABLE imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id),
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  filename        TEXT NOT NULL,
  status          TEXT NOT NULL, -- preview, committed, failed
  total_rows      INT NOT NULL DEFAULT 0,
  imported_rows   INT NOT NULL DEFAULT 0,
  duplicate_rows  INT NOT NULL DEFAULT 0,
  invalid_rows    INT NOT NULL DEFAULT 0,
  rejected_rows   INT NOT NULL DEFAULT 0,
  column_map      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id     UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  row_number    INT NOT NULL,
  raw           JSONB,
  errors        JSONB NOT NULL
);

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  lead_id       UUID REFERENCES leads(id),
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  old_value     JSONB,
  new_value     JSONB,
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at);

CREATE TABLE saved_filters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  screen        TEXT NOT NULL, -- leads, dashboard, reports
  query         JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
