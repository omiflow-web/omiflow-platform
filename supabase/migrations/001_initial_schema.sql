-- ============================================
-- OMIFLOW PLATFORM - COMPLETE DATABASE SCHEMA
-- ============================================
-- Run this entire file in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT NOT NULL DEFAULT 'immigration_law',
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'America/New_York',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_onboarded BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROLES
-- ============================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description, permissions) VALUES
  ('owner', 'Organization owner - full access', '{"all": true}'),
  ('manager', 'Manager - all except billing', '{"calls": true, "leads": true, "tasks": true, "reports": true, "staff": true, "settings": true}'),
  ('solicitor', 'Solicitor - assigned leads and calls', '{"calls": true, "leads": "assigned", "tasks": "assigned"}'),
  ('receptionist', 'Receptionist - calls and leads, no reports', '{"calls": true, "leads": true, "tasks": true}'),
  ('administrator', 'Admin - settings and staff management', '{"settings": true, "staff": true, "calls": true}');

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_omiflow_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "in_app": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STAFF MEMBERS
-- ============================================
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role_id UUID REFERENCES roles(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  extension TEXT,
  is_active BOOLEAN DEFAULT true,
  receives_notifications BOOLEAN DEFAULT true,
  practice_areas TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHONE NUMBERS
-- ============================================
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  twilio_sid TEXT,
  friendly_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  forward_to TEXT,
  ring_count INTEGER DEFAULT 3,
  business_hours JSONB DEFAULT '{"enabled": false, "timezone": "America/New_York", "hours": {"mon": {"open": "09:00", "close": "17:00"}, "tue": {"open": "09:00", "close": "17:00"}, "wed": {"open": "09:00", "close": "17:00"}, "thu": {"open": "09:00", "close": "17:00"}, "fri": {"open": "09:00", "close": "17:00"}, "sat": null, "sun": null}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRACTICE AREAS
-- ============================================
CREATE TABLE practice_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6172f3',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default practice areas inserted per org via function
-- ============================================
-- LEADS
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'consultation_scheduled', 'consultation_completed', 'retained', 'lost', 'not_interested')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  practice_area_id UUID REFERENCES practice_areas(id),
  assigned_to UUID REFERENCES staff_members(id),
  source TEXT DEFAULT 'inbound_call',
  notes TEXT,
  is_repeat_caller BOOLEAN DEFAULT false,
  first_contact_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  consultation_scheduled_at TIMESTAMPTZ,
  retained_at TIMESTAMPTZ,
  estimated_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  lost_reason TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAD STATUSES (history)
-- ============================================
CREATE TABLE lead_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALLS
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  phone_number_id UUID REFERENCES phone_numbers(id),
  staff_member_id UUID REFERENCES staff_members(id),
  caller_number TEXT NOT NULL,
  caller_name TEXT,
  direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  handled_by TEXT DEFAULT 'ai' CHECK (handled_by IN ('ai', 'human', 'missed', 'voicemail')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'missed', 'failed')),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  vapi_call_id TEXT,
  twilio_call_sid TEXT,
  recording_url TEXT,
  recording_duration INTEGER,
  is_test BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RECORDINGS
-- ============================================
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  format TEXT DEFAULT 'mp3',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSCRIPTS
-- ============================================
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_structured JSONB,
  word_count INTEGER,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUMMARIES
-- ============================================
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  key_points TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SENTIMENT SCORES
-- ============================================
CREATE TABLE sentiment_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'concerned', 'distressed', 'frustrated', 'urgent', 'confused')),
  score DECIMAL(3,2),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAD SCORES
-- ============================================
CREATE TABLE lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  quality TEXT NOT NULL CHECK (quality IN ('low', 'medium', 'high', 'critical')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 100),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALL CLASSIFICATIONS
-- ============================================
CREATE TABLE call_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  practice_area_id UUID REFERENCES practice_areas(id),
  practice_area_name TEXT,
  confidence DECIMAL(3,2),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOLLOW UP RECOMMENDATIONS
-- ============================================
CREATE TABLE follow_up_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  recommendation TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('call_within_1_hour', 'call_within_24_hours', 'schedule_consultation', 'send_information', 'escalate', 'no_action')),
  due_by TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  staff_member_id UUID REFERENCES staff_members(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'consultation' CHECK (type IN ('consultation', 'follow_up', 'virtual', 'in_person', 'phone')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  location TEXT,
  meeting_url TEXT,
  google_event_id TEXT,
  microsoft_event_id TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  call_id UUID REFERENCES calls(id),
  assigned_to UUID REFERENCES staff_members(id),
  created_by UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'callback' CHECK (type IN ('callback', 'follow_up', 'consultation_prep', 'escalation', 'document_review', 'general')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_auto_generated BOOLEAN DEFAULT false,
  trigger_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  lead_id UUID REFERENCES leads(id),
  call_id UUID REFERENCES calls(id),
  task_id UUID REFERENCES tasks(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'urgent', 'success')),
  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMUNICATIONS (unified log)
-- ============================================
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  call_id UUID REFERENCES calls(id),
  type TEXT NOT NULL CHECK (type IN ('call', 'sms', 'email')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  content TEXT,
  status TEXT DEFAULT 'sent',
  external_id TEXT,
  staff_member_id UUID REFERENCES staff_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SMS MESSAGES
-- ============================================
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  communication_id UUID REFERENCES communications(id),
  lead_id UUID REFERENCES leads(id),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT DEFAULT 'sent',
  direction TEXT DEFAULT 'outbound',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAILS
-- ============================================
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  communication_id UUID REFERENCES communications(id),
  lead_id UUID REFERENCES leads(id),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  resend_id TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE BASES
-- ============================================
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Knowledge Base',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  document_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE DOCUMENTS
-- ============================================
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT,
  content_text TEXT,
  chunk_count INTEGER DEFAULT 0,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE CHUNKS (for RAG)
-- ============================================
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION SETTINGS
-- ============================================
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  business_name TEXT,
  business_hours JSONB DEFAULT '{}',
  callback_promise_hours INTEGER DEFAULT 2,
  escalation_hours INTEGER DEFAULT 24,
  auto_sms_enabled BOOLEAN DEFAULT true,
  auto_email_enabled BOOLEAN DEFAULT true,
  auto_task_creation BOOLEAN DEFAULT true,
  sms_confirmation_template TEXT DEFAULT 'Thank you for contacting {firm_name}. A member of our team will call you back within {callback_hours} hours.',
  email_summary_recipients TEXT[] DEFAULT '{}',
  notification_email TEXT,
  notification_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION AI CONFIGS
-- ============================================
CREATE TABLE organization_ai_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  vapi_assistant_id TEXT,
  assistant_name TEXT DEFAULT 'AI Receptionist',
  voice_id TEXT DEFAULT 'jennifer',
  greeting_message TEXT,
  system_prompt TEXT,
  max_call_duration_seconds INTEGER DEFAULT 600,
  collect_name BOOLEAN DEFAULT true,
  collect_callback_number BOOLEAN DEFAULT true,
  collect_reason BOOLEAN DEFAULT true,
  book_appointments BOOLEAN DEFAULT false,
  use_knowledge_base BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION PROMPTS
-- ============================================
CREATE TABLE organization_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_type TEXT CHECK (prompt_type IN ('greeting', 'intake', 'knowledge', 'escalation', 'closing', 'custom')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION LANGUAGES
-- ============================================
CREATE TABLE organization_languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CRM INTEGRATIONS
-- ============================================
CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gohighlevel', 'hubspot', 'clio', 'salesforce')),
  is_active BOOLEAN DEFAULT false,
  credentials JSONB DEFAULT '{}',
  sync_leads BOOLEAN DEFAULT true,
  sync_calls BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALENDAR INTEGRATIONS
-- ============================================
CREATE TABLE calendar_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  user_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT false,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT,
  calendar_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BILLING SUBSCRIPTIONS
-- ============================================
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status TEXT DEFAULT 'trialing' CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  monthly_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'usd',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API KEYS
-- ============================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEBHOOKS
-- ============================================
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_calls_organization ON calls(organization_id);
CREATE INDEX idx_calls_lead ON calls(lead_id);
CREATE INDEX idx_calls_caller_number ON calls(caller_number);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_leads_organization ON leads(organization_id);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_priority ON leads(priority);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_tasks_organization ON tasks(organization_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_transcripts_call ON transcripts(call_id);
CREATE INDEX idx_knowledge_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX idx_communications_lead ON communications(lead_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (multi-tenancy enforcement)
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's organization
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: check if user is omiflow admin
CREATE OR REPLACE FUNCTION is_omiflow_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_omiflow_admin, false) FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies: org-scoped access
-- Organizations
CREATE POLICY "Users see own org" ON organizations
  FOR SELECT USING (id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Admins manage orgs" ON organizations
  FOR ALL USING (is_omiflow_admin());

-- Users
CREATE POLICY "Users see own org users" ON users
  FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Users update own record" ON users
  FOR UPDATE USING (id = auth.uid());

-- Generic org-scoped policy macro (applied to all tables with organization_id)
CREATE POLICY "Org scoped select" ON staff_members FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON staff_members FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON phone_numbers FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON phone_numbers FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON practice_areas FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON practice_areas FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON leads FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON leads FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON lead_statuses FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON lead_statuses FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON calls FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON calls FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON recordings FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON recordings FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON transcripts FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON transcripts FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON summaries FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON summaries FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON sentiment_scores FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON sentiment_scores FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON lead_scores FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON lead_scores FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON call_classifications FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON call_classifications FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON follow_up_recommendations FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON follow_up_recommendations FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON appointments FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON appointments FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON tasks FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON tasks FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON notifications FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON notifications FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON communications FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON communications FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON sms_messages FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON sms_messages FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON emails FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON emails FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON knowledge_bases FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON knowledge_bases FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON knowledge_documents FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON knowledge_documents FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON knowledge_chunks FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON knowledge_chunks FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON organization_settings FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON organization_settings FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON organization_ai_configs FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON organization_ai_configs FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON organization_prompts FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON organization_prompts FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON organization_languages FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON organization_languages FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON crm_integrations FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON crm_integrations FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON calendar_integrations FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON calendar_integrations FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON billing_subscriptions FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON billing_subscriptions FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON audit_logs FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped insert" ON audit_logs FOR INSERT WITH CHECK (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON api_keys FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON api_keys FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

CREATE POLICY "Org scoped select" ON webhooks FOR SELECT USING (organization_id = get_user_org_id() OR is_omiflow_admin());
CREATE POLICY "Org scoped all" ON webhooks FOR ALL USING (organization_id = get_user_org_id() OR is_omiflow_admin());

-- ============================================
-- SERVICE ROLE BYPASS (for API routes)
-- ============================================
-- Service role key bypasses RLS automatically in Supabase
-- All webhook handlers use service role client

-- ============================================
-- FUNCTION: provision new organization
-- ============================================
CREATE OR REPLACE FUNCTION provision_organization(org_id UUID, industry_type TEXT DEFAULT 'immigration_law')
RETURNS void AS $$
DECLARE
  kb_id UUID;
BEGIN
  -- Create knowledge base
  INSERT INTO knowledge_bases (organization_id, name, description)
  VALUES (org_id, 'Main Knowledge Base', 'Primary knowledge base for AI receptionist')
  RETURNING id INTO kb_id;

  -- Create org settings
  INSERT INTO organization_settings (organization_id)
  VALUES (org_id)
  ON CONFLICT DO NOTHING;

  -- Create AI config
  INSERT INTO organization_ai_configs (organization_id)
  VALUES (org_id)
  ON CONFLICT DO NOTHING;

  -- Create default languages
  INSERT INTO organization_languages (organization_id, language_code, language_name, is_primary)
  VALUES (org_id, 'en', 'English', true);

  -- Create practice areas based on industry
  IF industry_type = 'immigration_law' THEN
    INSERT INTO practice_areas (organization_id, name, color) VALUES
      (org_id, 'Spouse Visa', '#6172f3'),
      (org_id, 'Student Visa', '#22c55e'),
      (org_id, 'Work Visa', '#f59e0b'),
      (org_id, 'Asylum', '#ef4444'),
      (org_id, 'Citizenship', '#8b5cf6'),
      (org_id, 'Family Petition', '#06b6d4'),
      (org_id, 'Deportation Defense', '#ec4899'),
      (org_id, 'DACA', '#14b8a6'),
      (org_id, 'Green Card', '#f97316'),
      (org_id, 'Other', '#6b7280');
  ELSIF industry_type = 'family_law' THEN
    INSERT INTO practice_areas (organization_id, name, color) VALUES
      (org_id, 'Divorce', '#ef4444'),
      (org_id, 'Child Custody', '#6172f3'),
      (org_id, 'Adoption', '#22c55e'),
      (org_id, 'Domestic Violence', '#ec4899'),
      (org_id, 'Prenuptial Agreement', '#f59e0b'),
      (org_id, 'Other', '#6b7280');
  ELSE
    INSERT INTO practice_areas (organization_id, name, color) VALUES
      (org_id, 'General Enquiry', '#6172f3'),
      (org_id, 'Consultation Request', '#22c55e'),
      (org_id, 'Other', '#6b7280');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: get dashboard stats
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'calls_today', (SELECT COUNT(*) FROM calls WHERE organization_id = org_id AND started_at >= CURRENT_DATE),
    'calls_this_week', (SELECT COUNT(*) FROM calls WHERE organization_id = org_id AND started_at >= date_trunc('week', NOW())),
    'ai_handled', (SELECT COUNT(*) FROM calls WHERE organization_id = org_id AND handled_by = 'ai' AND started_at >= date_trunc('week', NOW())),
    'human_handled', (SELECT COUNT(*) FROM calls WHERE organization_id = org_id AND handled_by = 'human' AND started_at >= date_trunc('week', NOW())),
    'missed_recovered', (SELECT COUNT(*) FROM calls WHERE organization_id = org_id AND handled_by = 'ai' AND started_at >= date_trunc('month', NOW())),
    'consultations_booked', (SELECT COUNT(*) FROM appointments WHERE organization_id = org_id AND type = 'consultation' AND created_at >= date_trunc('month', NOW())),
    'pending_follow_ups', (SELECT COUNT(*) FROM tasks WHERE organization_id = org_id AND status = 'pending'),
    'urgent_leads', (SELECT COUNT(*) FROM leads WHERE organization_id = org_id AND priority = 'critical' AND status NOT IN ('retained', 'lost')),
    'new_leads_today', (SELECT COUNT(*) FROM leads WHERE organization_id = org_id AND created_at >= CURRENT_DATE),
    'total_leads', (SELECT COUNT(*) FROM leads WHERE organization_id = org_id)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_organization_ai_configs_updated_at BEFORE UPDATE ON organization_ai_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
