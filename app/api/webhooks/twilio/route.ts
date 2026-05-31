import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInboundTwiML, generateAfterHoursTwiML, isBusinessHours } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callerNumber = formData.get('From') as string
    const toNumber = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    console.log(`📞 Inbound call: from=${callerNumber} to=${toNumber} sid=${callSid}`)

    const db = createServiceClient() as any

    // Find organization by phone number
    const { data: phoneRecord } = await db
      .from('phone_numbers')
      .select(`
        id,
        organization_id,
        forward_to,
        ring_count,
        business_hours,
        organizations (id, name, timezone),
        organization_ai_configs (vapi_assistant_id)
      `)
      .eq('number', toNumber)
      .eq('is_active', true)
      .single()

    if (!phoneRecord) {
      console.error('No phone record found for:', toNumber)
      // Return basic TwiML so call doesn't just die silently
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We are unable to take your call right now. Please try again later.</Say>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    const org = phoneRecord.organizations
    const aiConfig = phoneRecord.organization_ai_configs
    const organizationId = phoneRecord.organization_id
    const vapiAssistantId = aiConfig?.vapi_assistant_id

    console.log(`📋 Found org: ${org?.name}, vapiAssistantId: ${vapiAssistantId}`)

    // Create call record immediately
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
    console.log(`💾 Call record created: ${callId}`)

    // Check business hours
    const duringBusinessHours = isBusinessHours(
      phoneRecord.business_hours,
      org?.timezone || 'Europe/London'
    )

    // No forward number set — go straight to AI
    if (!phoneRecord.forward_to) {
      console.log('No forward_to set — going straight to AI')

      if (!vapiAssistantId) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${org?.name || 'us'}. We are currently unavailable. Please call back during business hours.</Say>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      const twiml = generateAfterHoursTwiML(vapiAssistantId)
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Outside business hours — go straight to AI
    if (!duringBusinessHours) {
      console.log('Outside business hours — going to AI')

      if (!vapiAssistantId) {
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${org?.name || 'us'}. We are currently closed. Please call back during business hours.</Say>
</Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      await db.from('calls').update({ handled_by: 'ai' }).eq('id', callId)
      const twiml = generateAfterHoursTwiML(vapiAssistantId)
      return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
    }

    // During business hours — ring firm first, fallback to AI
    const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/fallback?callId=${callId}&orgId=${organizationId}&assistantId=${vapiAssistantId}`

    console.log(`📲 Ringing ${phoneRecord.forward_to} with fallback to AI`)

    const twiml = generateInboundTwiML(
      phoneRecord.forward_to,
      fallbackUrl,
      phoneRecord.ring_count || 3
    )

    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })

  } catch (error: any) {
    console.error('Twilio webhook error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We are sorry, we are experiencing technical difficulties. Please call back shortly.</Say>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
