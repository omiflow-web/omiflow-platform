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

Analyse this transcript carefully. The transcription may have errors — use context to understand what was actually said. For example "thank God" likely means "green card", names may be spelled phonetically.

TRANSCRIPT:
${transcript}

AVAILABLE PRACTICE AREAS:
${practiceAreasList}

Return ONLY valid JSON with these exact fields:
{
  "callType": "enquiry|complaint|existing_client|wrong_number|supplier|other",
  "summary": "2-3 sentence summary of the call",
  "keyPoints": ["key point 1", "key point 2"],
  "actionItems": ["action item 1"],
  "sentiment": "positive|neutral|concerned|distressed|frustrated|urgent|confused",
  "sentimentScore": 0.8,
  "sentimentReasoning": "caller mentioned urgency and needed help as soon as possible",
  "practiceArea": "most relevant practice area name from the list",
  "practiceAreaConfidence": 0.9,
  "practiceAreaReasoning": "caller mentioned green card and visa",
  "leadQuality": "low|medium|high|critical",
  "leadScore": 75,
  "urgencyScore": 80,
  "leadReasoning": "caller expressed urgency and clear legal need",
  "recommendation": "Call back Naomi urgently regarding green card / visa matter",
  "actionType": "call_within_1_hour|call_within_24_hours|schedule_consultation|send_information|escalate|no_action",
  "dueByHours": 2,
  "callerName": "full name extracted from transcript or null",
  "callerCallbackNumber": "phone number extracted from transcript or null",
  "callerReason": "one sentence reason for calling"
}

IMPORTANT RULES:
- If the caller says they need help urgently or as soon as possible, set sentiment to "urgent" and leadQuality to "high" or "critical"
- Extract the caller name even if spelled out letter by letter
- Extract phone numbers even if spoken as individual digits
- The transcription has errors — use context. "thank God" = "green card", "Scott's the food of the month" = likely background noise, ignore it
- If callType is complaint/wrong_number/supplier set leadQuality to "low"`

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

  // Update call type
  try {
    await db.from('calls').update({ call_type: result.callType }).eq('id', callId)
  } catch (e) { console.error('call_type update failed:', e) }

  // Save summary
  try {
    await db.from('summaries').insert({
      organization_id: organizationId,
      call_id: callId,
      content: result.summary,
      key_points: result.keyPoints,
      action_items: result.actionItems
    })
  } catch (e) { console.error('summaries insert failed:', e) }

  // Save sentiment
  try {
    await db.from('sentiment_scores').insert({
      organization_id: organizationId,
      call_id: callId,
      sentiment: result.sentiment,
      score: result.sentimentScore,
      reasoning: result.sentimentReasoning
    })
  } catch (e) { console.error('sentiment_scores insert failed:', e) }

  // Save lead score
  try {
    await db.from('lead_scores').insert({
      organization_id: organizationId,
      call_id: callId,
      lead_id: leadId,
      quality: result.leadQuality,
      score: result.leadScore,
      urgency_score: result.urgencyScore,
      reasoning: result.leadReasoning
    })
  } catch (e) { console.error('lead_scores insert failed:', e) }

  // Save call classification
  try {
    await db.from('call_classifications').insert({
      organization_id: organizationId,
      call_id: callId,
      practice_area_name: result.practiceArea,
      confidence: result.practiceAreaConfidence,
      reasoning: result.practiceAreaReasoning
    })
  } catch (e) { console.error('call_classifications insert failed:', e) }

  // Save follow up recommendation
  try {
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
  } catch (e) { console.error('follow_up_recommendations insert failed:', e) }

  // Update lead priority
  if (leadId) {
    try {
      await db.from('leads').update({
        priority: result.leadQuality,
        last_contact_at: new Date().toISOString()
      }).eq('id', leadId)
    } catch (e) { console.error('lead priority update failed:', e) }
  }
}

export async function findOrCreateLead(
  organizationId: string,
  callerNumber: string,
  callerName: string | null,
  result: AIProcessingResult
): Promise<{ leadId: string; isRepeat: boolean }> {
  const db = createServiceClient() as any

  const isActualLead = result.callType === 'enquiry'

  // Check for existing lead by phone
  if (callerNumber && callerNumber !== 'unknown') {
    const { data: existingLead } = await db
      .from('leads')
      .select('id, priority')
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
  }

  // Find matching practice area
  let practiceAreaId = null
  try {
    const { data: practiceArea } = await db
      .from('practice_areas')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('name', `%${result.practiceArea}%`)
      .limit(1)
      .single()
    practiceAreaId = practiceArea?.id || null
  } catch (e) { /* no match found */ }

  // Parse name — handle spelled-out names like "n w o k e j i" → "Nwokeji"
  const rawName = result.callerName || callerName || ''
  const nameParts = rawName.trim().split(' ').filter(Boolean)
  const firstName = nameParts[0] || null
  const lastName = nameParts.slice(1).join(' ') || null

  // Parse callback number from result if caller number is unknown
  let phoneToUse = callerNumber
  if (callerNumber === 'unknown' && result.callerCallbackNumber) {
    phoneToUse = result.callerCallbackNumber.replace(/\s/g, '')
    if (!phoneToUse.startsWith('+')) {
      phoneToUse = phoneToUse.replace(/^0/, '+44')
    }
  }

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
      phone: phoneToUse,
      status: statusMap[result.callType] || 'new',
      priority: isActualLead ? result.leadQuality : 'low',
      practice_area_id: practiceAreaId,
      source: 'inbound_call',
      notes: result.callerReason,
      tags: result.callType !== 'enquiry' ? [result.callType] : [],
      first_contact_at: new Date().toISOString(),
      last_contact_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !newLead) {
    console.error('Lead creation failed:', error)
    throw new Error(`Failed to create lead: ${error?.message}`)
  }

  try {
    await db.from('lead_statuses').insert({
      organization_id: organizationId,
      lead_id: newLead.id,
      status: statusMap[result.callType] || 'new'
    })
  } catch (e) { console.error('lead_statuses insert failed:', e) }

  return { leadId: newLead.id, isRepeat: false }
}

export async function createAutoTasks(
  organizationId: string,
  leadId: string,
  callId: string,
  result: AIProcessingResult
): Promise<void> {
  if (result.callType !== 'enquiry') return

  const db = createServiceClient() as any

  try {
    const { data: settings } = await db
      .from('organization_settings')
      .select('callback_promise_hours, auto_task_creation')
      .eq('organization_id', organizationId)
      .single()

    if (settings?.auto_task_creation === false) return

    const callbackHours = settings?.callback_promise_hours || 2
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
  } catch (e) { console.error('createAutoTasks failed:', e) }
}
