import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type CallType = 'enquiry' | 'complaint' | 'existing_client' | 'wrong_number' | 'supplier' | 'other'
export type SentimentType = 'positive' | 'neutral' | 'concerned' | 'distressed' | 'frustrated' | 'urgent' | 'confused'
export type LeadQuality = 'low' | 'medium' | 'high' | 'critical'
export type ActionType = 'call_within_1_hour' | 'call_within_24_hours' | 'schedule_consultation' | 'send_information' | 'escalate' | 'no_action'

export interface AIProcessingResult {
  callType: CallType
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
  const practiceAreasList = practiceAreas.join(', ') || 'General Legal Services'

  const prompt = `You are an AI assistant processing a call transcript for a law firm intake system.

Analyse this transcript carefully and return a JSON object.

TRANSCRIPT:
${transcript}

AVAILABLE PRACTICE AREAS:
${practiceAreasList}

FIRST — determine the call type. This is critical for the firm's reporting:
- enquiry: Someone asking about services, wanting to become a client, asking about a legal matter
- complaint: Someone unhappy about service they already received, complaining about the firm or a solicitor
- existing_client: Someone who is already a client calling about their existing case
- wrong_number: Called the wrong number
- supplier: A salesperson, recruiter, or vendor calling
- other: Anything that doesn't fit the above

Return ONLY valid JSON:
{
  "callType": "enquiry|complaint|existing_client|wrong_number|supplier|other",
  "summary": "2-3 sentence plain English summary",
  "keyPoints": ["key", "points", "from", "call"],
  "actionItems": ["recommended", "action", "items"],
  "sentiment": "positive|neutral|concerned|distressed|frustrated|urgent|confused",
  "sentimentScore": 0.0,
  "sentimentReasoning": "brief explanation",
  "practiceArea": "most relevant practice area or 'General Enquiry'",
  "practiceAreaConfidence": 0.0,
  "practiceAreaReasoning": "why this area",
  "leadQuality": "low|medium|high|critical",
  "leadScore": 0,
  "urgencyScore": 0,
  "leadReasoning": "why this score",
  "recommendation": "plain English next action",
  "actionType": "call_within_1_hour|call_within_24_hours|schedule_consultation|send_information|escalate|no_action",
  "dueByHours": 2,
  "callerName": "name or null",
  "callerCallbackNumber": "number or null",
  "callerReason": "one sentence reason or null"
}

Important: If callType is complaint, existing_client, wrong_number, or supplier — set leadQuality to "low" and actionType to "no_action" unless there is a genuine new legal need expressed.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected AI response type')

  const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonText) as AIProcessingResult
}

export async function saveAIResults(
  result: AIProcessingResult,
  organizationId: string,
  callId: string,
  leadId: string | null
): Promise<void> {
  const db = createServiceClient() as any

  // Update call with type
  await db.from('calls').update({ call_type: result.callType }).eq('id', callId)

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

  // Non-enquiry calls still get a lead record but marked as not a lead
  const isActualLead = result.callType === 'enquiry'

  const { data: existingLead } = await db
    .from('leads')
    .select('id, is_repeat_caller')
    .eq('organization_id', organizationId)
    .eq('phone', callerNumber)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingLead) {
    await db.from('leads').update({
      is_repeat_caller: true,
      last_contact_at: new Date().toISOString(),
      priority: isActualLead ? result.leadQuality : existingLead.priority
    }).eq('id', existingLead.id)
    return { leadId: existingLead.id, isRepeat: true }
  }

  const { data: practiceArea } = await db
    .from('practice_areas')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', `%${result.practiceArea}%`)
    .limit(1)
    .single()

  const nameParts = (result.callerName || callerName || '').trim().split(' ')
  const firstName = nameParts[0] || null
  const lastName = nameParts.slice(1).join(' ') || null

  // Map call type to status
  const statusMap: Record<string, string> = {
    enquiry: 'new',
    complaint: 'new',
    existing_client: 'contacted',
    wrong_number: 'not_interested',
    supplier: 'not_interested',
    other: 'new'
  }

  const { data: newLead, error } = await db
    .from('leads')
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      phone: callerNumber,
      status: statusMap[result.callType] || 'new',
      priority: isActualLead ? result.leadQuality : 'low',
      practice_area_id: practiceArea?.id || null,
      source: 'inbound_call',
      notes: result.callerReason,
      tags: result.callType !== 'enquiry' ? [result.callType] : [],
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !newLead) throw new Error(`Failed to create lead: ${error?.message}`)

  await db.from('lead_statuses').insert({
    organization_id: organizationId,
    lead_id: newLead.id,
    status: statusMap[result.callType] || 'new'
  })

  return { leadId: newLead.id, isRepeat: false }
}

export async function createAutoTasks(
  organizationId: string,
  leadId: string,
  callId: string,
  result: AIProcessingResult
): Promise<void> {
  // Don't create callback tasks for non-enquiry calls
  if (result.callType !== 'enquiry') return

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

  await db.from('tasks').insert({
    organization_id: organizationId,
    lead_id: leadId,
    call_id: callId,
    title: `Call back ${result.callerName || 'caller'} — ${result.practiceArea}`,
    description: result.recommendation,
    type: 'callback',
    priority,
    status: 'pending',
    due_at: dueAt.toISOString(),
    is_auto_generated: true,
    trigger_rule: 'post_call_ai'
  })
}
