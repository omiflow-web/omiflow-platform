export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SentimentType = 'positive' | 'neutral' | 'concerned' | 'distressed' | 'frustrated' | 'urgent' | 'confused'
export type LeadStatus = 'new' | 'contacted' | 'consultation_scheduled' | 'consultation_completed' | 'retained' | 'lost' | 'not_interested'
export type LeadPriority = 'low' | 'medium' | 'high' | 'critical'
export type LeadQuality = 'low' | 'medium' | 'high' | 'critical'
export type CallHandledBy = 'ai' | 'human' | 'missed' | 'voicemail'
export type TaskType = 'callback' | 'follow_up' | 'consultation_prep' | 'escalation' | 'document_review' | 'general'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type AppointmentType = 'consultation' | 'follow_up' | 'virtual' | 'in_person' | 'phone'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled'
export type ActionType = 'call_within_1_hour' | 'call_within_24_hours' | 'schedule_consultation' | 'send_information' | 'escalate' | 'no_action'

export interface Organization {
  id: string
  name: string
  slug: string
  industry: string
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  logo_url: string | null
  is_active: boolean
  is_onboarded: boolean
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  organization_id: string | null
  role_id: string | null
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  is_omiflow_admin: boolean
  is_active: boolean
  last_seen_at: string | null
  notification_preferences: Json
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  organization_id: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  status: LeadStatus
  priority: LeadPriority
  practice_area_id: string | null
  assigned_to: string | null
  source: string
  notes: string | null
  is_repeat_caller: boolean
  first_contact_at: string | null
  last_contact_at: string | null
  consultation_scheduled_at: string | null
  retained_at: string | null
  estimated_value: number | null
  actual_value: number | null
  lost_reason: string | null
  tags: string[]
  metadata: Json
  created_at: string
  updated_at: string
  // joined
  practice_area?: PracticeArea
  assigned_staff?: StaffMember
}

export interface Call {
  id: string
  organization_id: string
  lead_id: string | null
  phone_number_id: string | null
  staff_member_id: string | null
  caller_number: string
  caller_name: string | null
  direction: string
  handled_by: CallHandledBy
  status: string
  duration_seconds: number
  started_at: string
  ended_at: string | null
  vapi_call_id: string | null
  twilio_call_sid: string | null
  recording_url: string | null
  recording_duration: number | null
  is_test: boolean
  metadata: Json
  created_at: string
  updated_at: string
  // joined
  transcript?: Transcript
  summary?: Summary
  sentiment?: SentimentScore
  lead_score?: LeadScore
  classification?: CallClassification
  follow_up?: FollowUpRecommendation
  lead?: Lead
}

export interface Transcript {
  id: string
  organization_id: string
  call_id: string
  content: string
  content_structured: Json
  word_count: number | null
  language: string
  created_at: string
}

export interface Summary {
  id: string
  organization_id: string
  call_id: string
  content: string
  key_points: string[]
  action_items: string[]
  created_at: string
}

export interface SentimentScore {
  id: string
  organization_id: string
  call_id: string
  sentiment: SentimentType
  score: number | null
  reasoning: string | null
  created_at: string
}

export interface LeadScore {
  id: string
  organization_id: string
  call_id: string
  lead_id: string | null
  quality: LeadQuality
  score: number | null
  urgency_score: number | null
  reasoning: string | null
  created_at: string
}

export interface CallClassification {
  id: string
  organization_id: string
  call_id: string
  practice_area_id: string | null
  practice_area_name: string | null
  confidence: number | null
  reasoning: string | null
  created_at: string
}

export interface FollowUpRecommendation {
  id: string
  organization_id: string
  call_id: string
  lead_id: string | null
  recommendation: string
  action_type: ActionType
  due_by: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export interface Task {
  id: string
  organization_id: string
  lead_id: string | null
  call_id: string | null
  assigned_to: string | null
  created_by: string | null
  title: string
  description: string | null
  type: TaskType
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  completed_at: string | null
  is_auto_generated: boolean
  trigger_rule: string | null
  created_at: string
  updated_at: string
  // joined
  lead?: Lead
  assigned_staff?: StaffMember
}

export interface Notification {
  id: string
  organization_id: string
  user_id: string | null
  lead_id: string | null
  call_id: string | null
  task_id: string | null
  title: string
  message: string
  type: string
  channel: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface Appointment {
  id: string
  organization_id: string
  lead_id: string | null
  staff_member_id: string | null
  title: string
  description: string | null
  type: AppointmentType
  status: AppointmentStatus
  starts_at: string
  ends_at: string
  duration_minutes: number
  location: string | null
  meeting_url: string | null
  google_event_id: string | null
  microsoft_event_id: string | null
  reminder_sent: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StaffMember {
  id: string
  organization_id: string
  user_id: string | null
  role_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  extension: string | null
  is_active: boolean
  receives_notifications: boolean
  practice_areas: string[]
  created_at: string
  updated_at: string
}

export interface PracticeArea {
  id: string
  organization_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
}

export interface PhoneNumber {
  id: string
  organization_id: string
  number: string
  twilio_sid: string | null
  friendly_name: string | null
  is_primary: boolean
  is_active: boolean
  forward_to: string | null
  ring_count: number
  business_hours: Json
  created_at: string
  updated_at: string
}

export interface OrganizationSettings {
  id: string
  organization_id: string
  business_name: string | null
  business_hours: Json
  callback_promise_hours: number
  escalation_hours: number
  auto_sms_enabled: boolean
  auto_email_enabled: boolean
  auto_task_creation: boolean
  sms_confirmation_template: string
  email_summary_recipients: string[]
  notification_email: string | null
  notification_phone: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationAIConfig {
  id: string
  organization_id: string
  vapi_assistant_id: string | null
  assistant_name: string
  voice_id: string
  greeting_message: string | null
  system_prompt: string | null
  max_call_duration_seconds: number
  collect_name: boolean
  collect_callback_number: boolean
  collect_reason: boolean
  book_appointments: boolean
  use_knowledge_base: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  document_count: number
  last_updated_at: string | null
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  organization_id: string
  knowledge_base_id: string
  title: string
  file_name: string | null
  file_type: string | null
  file_size_bytes: number | null
  storage_path: string | null
  content_text: string | null
  chunk_count: number
  is_processed: boolean
  processed_at: string | null
  uploaded_by: string | null
  created_at: string
}

export interface Communication {
  id: string
  organization_id: string
  lead_id: string | null
  call_id: string | null
  type: 'call' | 'sms' | 'email'
  direction: 'inbound' | 'outbound'
  from_address: string | null
  to_address: string | null
  subject: string | null
  content: string | null
  status: string
  external_id: string | null
  staff_member_id: string | null
  created_at: string
}

export interface DashboardStats {
  calls_today: number
  calls_this_week: number
  ai_handled: number
  human_handled: number
  missed_recovered: number
  consultations_booked: number
  pending_follow_ups: number
  urgent_leads: number
  new_leads_today: number
  total_leads: number
}

export interface BillingSubscription {
  id: string
  organization_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'starter' | 'professional' | 'enterprise'
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  monthly_amount: number | null
  currency: string
  created_at: string
  updated_at: string
}

// Stub for full Database type - expand as needed
export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> }
      calls: { Row: Call; Insert: Partial<Call>; Update: Partial<Call> }
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> }
      transcripts: { Row: Transcript; Insert: Partial<Transcript>; Update: Partial<Transcript> }
      summaries: { Row: Summary; Insert: Partial<Summary>; Update: Partial<Summary> }
      sentiment_scores: { Row: SentimentScore; Insert: Partial<SentimentScore>; Update: Partial<SentimentScore> }
      lead_scores: { Row: LeadScore; Insert: Partial<LeadScore>; Update: Partial<LeadScore> }
      call_classifications: { Row: CallClassification; Insert: Partial<CallClassification>; Update: Partial<CallClassification> }
      follow_up_recommendations: { Row: FollowUpRecommendation; Insert: Partial<FollowUpRecommendation>; Update: Partial<FollowUpRecommendation> }
      staff_members: { Row: StaffMember; Insert: Partial<StaffMember>; Update: Partial<StaffMember> }
      practice_areas: { Row: PracticeArea; Insert: Partial<PracticeArea>; Update: Partial<PracticeArea> }
      phone_numbers: { Row: PhoneNumber; Insert: Partial<PhoneNumber>; Update: Partial<PhoneNumber> }
      organization_settings: { Row: OrganizationSettings; Insert: Partial<OrganizationSettings>; Update: Partial<OrganizationSettings> }
      organization_ai_configs: { Row: OrganizationAIConfig; Insert: Partial<OrganizationAIConfig>; Update: Partial<OrganizationAIConfig> }
      knowledge_bases: { Row: KnowledgeBase; Insert: Partial<KnowledgeBase>; Update: Partial<KnowledgeBase> }
      knowledge_documents: { Row: KnowledgeDocument; Insert: Partial<KnowledgeDocument>; Update: Partial<KnowledgeDocument> }
      communications: { Row: Communication; Insert: Partial<Communication>; Update: Partial<Communication> }
      billing_subscriptions: { Row: BillingSubscription; Insert: Partial<BillingSubscription>; Update: Partial<BillingSubscription> }
    }
    Functions: {
      get_user_org_id: { Args: Record<string, never>; Returns: string }
      is_omiflow_admin: { Args: Record<string, never>; Returns: boolean }
      get_dashboard_stats: { Args: { org_id: string }; Returns: Json }
      provision_organization: { Args: { org_id: string; industry_type?: string }; Returns: void }
    }
  }
}
