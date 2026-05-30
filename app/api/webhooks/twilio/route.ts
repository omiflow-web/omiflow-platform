import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInboundTwiML, generateAfterHoursTwiML, isBusinessHours } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callerNumber = formData.get('From') as string
    const toNumber = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    const db = createServiceClient() as any

    const { data: phoneRecord } = await db
      .from('phone_numbers')
      .select('id, organization_id, forward_to, ring_count, business_hours, organizations(id, name, timezone), organization_ai_configs(vapi_assistant_id)')
      .eq('number', toNumber)
      .eq('is_active', true)
      .single()

    if (!phoneRecord) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again later.</Say></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const org = phoneRecord.organizations
    const aiConfig = phoneRecord.organization_ai_configs
    const organizationId = phoneRecord.organization_id
    const vapiAssistantId = aiConfig?.vapi_assistant_id

    const { data: callRecord } = await db
      .from('calls')
      .insert({
        organization_id: organizationId,
        phone_number_id: phoneRecord.id,
        caller_number: callerNumber,
        direction: 'inbound',
        handled_by: 'ai',
        status: 'in_progress',
        twilio_call_sid: callSid,
        started_at: new Date().toISOString()
      })
      .select('id')
      .single()

    const callId = callRecord?.id

    const duringBusinessHours = isBusinessHours(
      phoneRecord.business_hours,
      org?.timezone || 'America/New_York'
    )

    if (!duringBusinessHours || !phoneRecord.forward_to) {
      if (!vapiAssistantId) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling ${org?.name || 'us'}. We are currently unavailable.</Say></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }
      await db.from('calls').update({ handled_by: 'ai' }).eq('id', callId)
      const twiml = generateAfterHoursTwiML(vapiAssistantId)
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/fallback?callId=${callId}&orgId=${organizationId}&assistantId=${vapiAssistantId}`
    const twiml = generateInboundTwiML(phoneRecord.forward_to, fallbackUrl, phoneRecord.ring_count || 3)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Twilio webhook error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing technical difficulties. Please call back shortly.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
