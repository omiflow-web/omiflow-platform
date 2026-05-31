import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'
import { SentimentType, LeadQuality, ActionType } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AIProcessingResult {
  summary: string
  keyPoints: string[]
  actionItems: string[]
  sentiment: SentimentType
  sentimentScore: number
  sentimentReasoning: string
  practiceArea: string
  practiceAreaConfidence: number
  practiceAreaReasoning: string
  leadQuality: LeadQuality
  leadScore: number
  urgencyScore: number
  leadReasoning: string
  recommendation: string
  actionType: ActionType
  dueByHours: number
  callerName: string | null
  callerCallbackNumber: string | null
  callerReason: string | null
}

export async function processCallWithAI(
  transcript: string,
  organizationId: string,
  callId: string,
  practiceAreas: string[]
): Promise<AIProcessingResult> {
  const practiceAreasList = practiceAreas.join(', ')

  const prompt = `You are an AI assistant processing a call transcript for a law firm intake system.

Analyse this call transcript and return a JSON object with the fields below.

TRANSCRIPT:
${transcript}

AVAILABLE PRACTICE AREAS FOR THIS FIRM:
${practiceAreasList || 'General Enquiry'}

Return ONLY valid JSON with these exact fields:
{
  "summary": "2-3 sentence plain English summary of the call",
  "keyPoints": ["array", "of", "key", "points", "from", "call"],
  "actionItems": ["array", "of", "recommended", "action", "items"],
  "sentiment": "one of: positive, neutral, concerned, distressed, frustrated, urgent, confused",
  "sentimentScore": 0.0 to 1.0,
  "sentimentReasoning": "brief explanation of detected sentiment",
  "practiceArea": "most relevant practice area from the list provided",
  "practiceAreaConfidence": 0.0 to 1.0,
  "practiceAreaReasoning": "why this practice area was selected",
  "leadQuality": "one of: low, medium, high, critical",
  "leadScore": 0 to 100,
  "urgencyScore": 0 to 100,
  "leadReasoning": "why this lead quality score was given",
  "recommendation": "plain English recommended next action for the firm",
  "actionType": "one of: call_within_1_hour, call_within_24_hours, schedule_consultation, send_information, escalate, no_action",
  "dueByHours": number of hours until action is due,
  "callerName": "extracted caller full name or null",
  "callerCallbackNumber": "extracted callback phone number or null",
  "callerReason": "main reason caller contacted the firm in one sentence"
}

Lead quality scoring:
- critical: Urgent legal matter, deportation, court date, visa expiry, clear intent to hire immediately
- high: Clear legal need, motivated to proceed, specific matter described in detail
- medium: General enquiry, exploring options, considering multiple firms
- low: Wrong number, very vague, not ready to proceed, unlikely to convert

Sentiment guide:
- distressed: Crying, very upset, frightened, mentions crisis or emergency
- urgent: Time-sensitive language, deadline mentioned, highly motivated
- frustrated: Annoyed, tried before, feels ignored or let down
- concerned: Worried but calm, anxious about outcome
- positive: Upbeat, confident, just gathering information
- neutral: Matter-of-fact, no strong emotion
- confused: Unsure what they need, asking many basic questions`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from AI')

  // Clean and parse JSON
  const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const result = JSON.parse(jsonText) as AIProcessingResult
  return result
}

export async function saveAIResults(
  result: AIProcessingResult,
  organizationId: string,
  callId: string,
  leadId: string | null
): Promise<void> {
  const db = createServiceClient() as any

  await Promise.all([
    db.from('summaries').insert({
      organization_id: organizationId,
      call_id: callId,
      content: result.summary,
      key_points: result.keyPoints,
      action_items: result.actionItems
    }),
    db.from('sentiment_scores').insert({
      organization_id: organizationId,
      call_id: callId,
      sentiment: result.sentiment,
      score: result.sentimentScore,
      reasoning: result.sentimentReasoning
    }),
    db.from('lead_scores').insert({
      organization_id: organizationId,
      call_id: callId,
      lead_id: leadId,
      quality: result.leadQuality,
      score: result.leadScore,
      urgency_score: result.urgencyScore,
      reasoning: result.leadReasoning
    }),
    db.from('call_classifications').insert({
      organization_id: organizationId,
      call_id: callId,
      practice_area_name: result.practiceArea,
      confidence: result.practiceAreaConfidence,
      reasoning: result.practiceAreaReasoning
    })
  ])

  // Save follow-up recommendation
  const dueBy = new Date()
  dueBy.setHours(dueBy.getHours() + result.dueByHours)

  await db.from('follow_up_recommendations').insert({
    organization_id: organizationId,
    call_id: callId,
    lead_id: leadId,
    recommendation: result.recommendation,
    action_type: result.actionType,
    due_by: dueBy.toISOString()
  })

  // Update lead priority and last contact
  if (leadId) {
    await db.from('leads').update({
      priority: result.leadQuality,
      last_contact_at: new Date().toISOString()
    }).eq('id', leadId)
  }
}

export async function findOrCreateLead(
  organizationId: string,
  callerNumber: string,
  callerName: string | null,
  result: AIProcessingResult
): Promise<{ leadId: string; isRepeat: boolean }> {
  const db = createServiceClient() as any

  // Check for existing lead with this phone number
  const { data: existingLead } = await db
    .from('leads')
    .select('id, is_repeat_caller')
    .eq('organization_id', organizationId)
    .eq('phone', callerNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingLead) {
    await db.from('leads').update({
      is_repeat_caller: true,
      last_contact_at: new Date().toISOString(),
      priority: result.leadQuality
    }).eq('id', existingLead.id)

    return { leadId: existingLead.id, isRepeat: true }
  }

  // Find matching practice area
  const { data: practiceArea } = await db
    .from('practice_areas')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', `%${result.practiceArea}%`)
    .limit(1)
    .single()

  // Parse caller name
  const nameParts = (result.callerName || callerName || '').trim().split(' ')
  const firstName = nameParts[0] || null
  const lastName = nameParts.slice(1).join(' ') || null

  const { data: newLead, error } = await db
    .from('leads')
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      phone: callerNumber,
      status: 'new',
      priority: result.leadQuality,
      practice_area_id: practiceArea?.id || null,
      source: 'inbound_call',
      notes: result.callerReason,
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !newLead) throw new Error(`Failed to create lead: ${error?.message}`)

  await db.from('lead_statuses').insert({
    organization_id: organizationId,
    lead_id: newLead.id,
    status: 'new'
  })

  return { leadId: newLead.id, isRepeat: false }
}

export async function createAutoTasks(
  organizationId: string,
  leadId: string,
  callId: string,
  result: AIProcessingResult
): Promise<void> {
  const db = createServiceClient() as any

  const { data: settings } = await db
    .from('organization_settings')
    .select('callback_promise_hours, auto_task_creation')
    .eq('organization_id', organizationId)
    .single()

  if (!settings?.auto_task_creation) return

  const callbackHours = settings.callback_promise_hours || 2
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + callbackHours)

  const priority = result.urgencyScore > 75 ? 'urgent' :
                   result.urgencyScore > 50 ? 'high' :
                   result.urgencyScore > 25 ? 'medium' : 'low'

  const callerDisplay = result.callerName || 'caller'

  await db.from('tasks').insert({
    organization_id: organizationId,
    lead_id: leadId,
    call_id: callId,
    title: `Call back ${callerDisplay} — ${result.practiceArea}`,
    description: result.recommendation,
    type: 'callback',
    priority,
    status: 'pending',
    due_at: dueAt.toISOString(),
    is_auto_generated: true,
    trigger_rule: 'post_call_ai'
  })
}
