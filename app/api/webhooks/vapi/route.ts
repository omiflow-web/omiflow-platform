import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { processCallWithAI, saveAIResults, findOrCreateLead, createAutoTasks } from '@/lib/ai-pipeline'
import { sendCallSummaryEmail } from '@/lib/email'
import { sendConfirmationSMS } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    // Vapi sends various event types - only process end of call
    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const vapiCallId = message.call?.id
    const transcript = message.artifact?.transcript || ''
    const recordingUrl = message.artifact?.recordingUrl || null
    const durationSeconds = Math.round(message.durationSeconds || 0)
    const callerNumber = message.call?.customer?.number || 'unknown'

    console.log(`📞 Vapi webhook received: callId=${vapiCallId}, caller=${callerNumber}, duration=${durationSeconds}s`)

    if (!vapiCallId) {
      console.error('No vapiCallId in webhook payload')
      return NextResponse.json({ error: 'Missing call ID' }, { status: 400 })
    }

    const db = createServiceClient() as any

    // Find the call record created by Twilio webhook
    const { data: callRecord } = await db
      .from('calls')
      .select('id, organization_id, lead_id')
      .eq('vapi_call_id', vapiCallId)
      .single()

    // If no call record found, create one (handles case where Vapi fires before Twilio)
    let callId: string
    let organizationId: string

    if (!callRecord) {
      console.log('No existing call record — looking up org by assistant')

      // Find org by vapi assistant ID
      const { data: aiConfig } = await db
        .from('organization_ai_configs')
        .select('organization_id')
        .eq('vapi_assistant_id', message.call?.assistantId)
        .single()

      if (!aiConfig) {
        console.error('Could not find org for assistant:', message.call?.assistantId)
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      organizationId = aiConfig.organization_id

      const { data: newCall } = await db
        .from('calls')
        .insert({
          organization_id: organizationId,
          caller_number: callerNumber,
          direction: 'inbound',
          handled_by: 'ai',
          status: 'completed',
          vapi_call_id: vapiCallId,
          recording_url: recordingUrl,
          duration_seconds: durationSeconds,
          started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
          ended_at: new Date().toISOString()
        })
        .select('id')
        .single()

      callId = newCall.id
    } else {
      callId = callRecord.id
      organizationId = callRecord.organization_id

      // Update call with final data
      await db.from('calls').update({
        recording_url: recordingUrl,
        duration_seconds: durationSeconds,
        status: 'completed',
        handled_by: 'ai',
        vapi_call_id: vapiCallId,
        ended_at: new Date().toISOString()
      }).eq('id', callId)
    }

    // Save recording
    if (recordingUrl) {
      await db.from('recordings').insert({
        organization_id: organizationId,
        call_id: callId,
        url: recordingUrl,
        duration_seconds: durationSeconds
      })
    }

    // Save transcript
    if (transcript) {
      await db.from('transcripts').insert({
        organization_id: organizationId,
        call_id: callId,
        content: transcript,
        content_structured: message.artifact?.messages || null,
        word_count: transcript.split(' ').length
      })
    }

    // Get practice areas for AI classification
    const { data: practiceAreas } = await db
      .from('practice_areas')
      .select('name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    const practiceAreaNames = (practiceAreas || []).map((p: any) => p.name)

    // Run AI pipeline — only if we have a transcript
    if (transcript && transcript.length > 50) {
      console.log(`🤖 Running AI pipeline for call ${callId}`)

      const aiResult = await processCallWithAI(
        transcript,
        organizationId,
        callId,
        practiceAreaNames
      )

      // Find or create lead
      const { leadId } = await findOrCreateLead(
        organizationId,
        callerNumber,
        aiResult.callerName,
        aiResult
      )

      // Link call to lead
      await db.from('calls').update({ lead_id: leadId }).eq('id', callId)

      // Save all AI scores
      await saveAIResults(aiResult, organizationId, callId, leadId)

      // Create follow-up tasks
      await createAutoTasks(organizationId, leadId, callId, aiResult)

      // Get org settings
      const { data: settings } = await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single()

      const { data: org } = await db
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      const firmName = org?.name || 'The firm'

      // Send summary email to firm
      if (settings?.auto_email_enabled && settings?.email_summary_recipients?.length > 0) {
        try {
          await sendCallSummaryEmail(
            settings.email_summary_recipients,
            firmName,
            callerNumber,
            aiResult,
            durationSeconds
          )
          console.log(`📧 Summary email sent to ${settings.email_summary_recipients.join(', ')}`)
        } catch (emailError) {
          console.error('Email send failed:', emailError)
        }
      }

      // Send confirmation SMS to caller
      if (settings?.auto_sms_enabled && callerNumber !== 'unknown') {
        try {
          await sendConfirmationSMS(
            callerNumber,
            firmName,
            settings?.callback_promise_hours || 2,
            settings?.sms_confirmation_template
          )

          await db.from('sms_messages').insert({
            organization_id: organizationId,
            lead_id: leadId,
            from_number: process.env.TWILIO_PHONE_NUMBER,
            to_number: callerNumber,
            body: `Thank you for contacting ${firmName}. We will call you back within ${settings?.callback_promise_hours || 2} hours.`,
            status: 'sent',
            direction: 'outbound'
          })
          console.log(`📱 SMS sent to ${callerNumber}`)
        } catch (smsError) {
          console.error('SMS send failed:', smsError)
        }
      }

      // Create urgent notifications for critical/distressed leads
      if (aiResult.leadQuality === 'critical' || aiResult.sentiment === 'distressed') {
        const { data: orgUsers } = await db
          .from('users')
          .select('id')
          .eq('organization_id', organizationId)

        for (const user of orgUsers || []) {
          await db.from('notifications').insert({
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
        console.log(`🚨 Urgent notification created for lead ${leadId}`)
      }

      // Log communication record
      await db.from('communications').insert({
        organization_id: organizationId,
        lead_id: leadId,
        call_id: callId,
        type: 'call',
        direction: 'inbound',
        from_address: callerNumber,
        content: aiResult.summary,
        status: 'completed'
      })

      console.log(`✅ Call fully processed: callId=${callId} leadId=${leadId} quality=${aiResult.leadQuality} sentiment=${aiResult.sentiment}`)
      return NextResponse.json({ success: true, callId, leadId })
    } else {
      console.log(`⚠️ Call ${callId} had no/short transcript — skipping AI pipeline`)
      return NextResponse.json({ success: true, callId, note: 'No transcript to process' })
    }

  } catch (error: any) {
    console.error('Vapi webhook error:', error)
    return NextResponse.json({ error: 'Processing failed', detail: error.message }, { status: 500 })
  }
}
