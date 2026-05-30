import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { processCallWithAI, saveAIResults, findOrCreateLead, createAutoTasks } from '@/lib/ai-pipeline'
import { sendCallSummaryEmail } from '@/lib/email'
import { sendConfirmationSMS } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    // Only process end-of-call reports
    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const vapiCallId = message.call?.id
    const transcript = message.artifact?.transcript || ''
    const recordingUrl = message.artifact?.recordingUrl || null
    const durationSeconds = Math.round(message.durationSeconds || 0)
    const callerNumber = message.call?.customer?.number || 'unknown'

    if (!vapiCallId || !transcript) {
      return NextResponse.json({ error: 'Missing call data' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Find the call record by vapi_call_id
    const { data: callRecord } = await supabase
      .from('calls')
      .select('id, organization_id, lead_id')
      .eq('vapi_call_id', vapiCallId)
      .single()

    if (!callRecord) {
      console.error('Call record not found for vapi_call_id:', vapiCallId)
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const { id: callId, organization_id: organizationId } = callRecord

    // Update call with recording and duration
    await supabase.from('calls').update({
      recording_url: recordingUrl,
      duration_seconds: durationSeconds,
      status: 'completed',
      ended_at: new Date().toISOString()
    }).eq('id', callId)

    // Save recording record
    if (recordingUrl) {
      await supabase.from('recordings').insert({
        organization_id: organizationId,
        call_id: callId,
        url: recordingUrl,
        duration_seconds: durationSeconds
      })
    }

    // Save transcript
    await supabase.from('transcripts').insert({
      organization_id: organizationId,
      call_id: callId,
      content: transcript,
      content_structured: message.artifact?.messages || null,
      word_count: transcript.split(' ').length
    })

    // Get practice areas for this org
    const { data: practiceAreas } = await supabase
      .from('practice_areas')
      .select('name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    const practiceAreaNames = practiceAreas?.map(p => p.name) || []

    // Run AI processing pipeline
    const aiResult = await processCallWithAI(
      transcript,
      organizationId,
      callId,
      practiceAreaNames
    )

    // Find or create lead
    const { leadId, isRepeat } = await findOrCreateLead(
      organizationId,
      callerNumber,
      aiResult.callerName,
      aiResult
    )

    // Link call to lead
    await supabase.from('calls').update({ lead_id: leadId }).eq('id', callId)

    // Save all AI results
    await saveAIResults(aiResult, organizationId, callId, leadId)

    // Create auto tasks
    await createAutoTasks(organizationId, leadId, callId, aiResult)

    // Get org settings for notifications
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const firmName = org?.name || 'The firm'

    // Send summary email to firm
    if (settings?.auto_email_enabled && settings.email_summary_recipients?.length > 0) {
      await sendCallSummaryEmail(
        settings.email_summary_recipients,
        firmName,
        callerNumber,
        aiResult,
        durationSeconds
      )
    }

    // Send confirmation SMS to caller
    if (settings?.auto_sms_enabled && callerNumber !== 'unknown') {
      try {
        await sendConfirmationSMS(
          callerNumber,
          firmName,
          settings.callback_promise_hours || 2,
          settings.sms_confirmation_template
        )

        // Log SMS communication
        await supabase.from('sms_messages').insert({
          organization_id: organizationId,
          lead_id: leadId,
          from_number: process.env.TWILIO_PHONE_NUMBER!,
          to_number: callerNumber,
          body: settings.sms_confirmation_template || `Thank you for contacting ${firmName}. We will call you back shortly.`,
          status: 'sent',
          direction: 'outbound'
        })
      } catch (smsError) {
        console.error('SMS send failed:', smsError)
        // Non-fatal — continue
      }
    }

    // Create in-app notification for urgent/critical leads
    if (aiResult.leadQuality === 'critical' || aiResult.sentiment === 'distressed') {
      const { data: orgUsers } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', organizationId)

      for (const user of orgUsers || []) {
        await supabase.from('notifications').insert({
          organization_id: organizationId,
          user_id: user.id,
          lead_id: leadId,
          call_id: callId,
          title: '🚨 Urgent Lead Requires Immediate Attention',
          message: `${aiResult.callerName || callerNumber} — ${aiResult.practiceArea}. ${aiResult.recommendation}`,
          type: 'urgent',
          channel: 'in_app'
        })
      }
    }

    // Log communication record
    await supabase.from('communications').insert({
      organization_id: organizationId,
      lead_id: leadId,
      call_id: callId,
      type: 'call',
      direction: 'inbound',
      from_address: callerNumber,
      content: aiResult.summary,
      status: 'completed'
    })

    console.log(`✅ Call processed: ${callId} | Lead: ${leadId} | Quality: ${aiResult.leadQuality} | Sentiment: ${aiResult.sentiment}`)

    return NextResponse.json({ success: true, callId, leadId })
  } catch (error) {
    console.error('Vapi webhook error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
