import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { processCallWithAI, saveAIResults, findOrCreateLead, createAutoTasks } from '@/lib/ai-pipeline'
import { sendCallSummaryEmail } from '@/lib/email'
import { sendConfirmationSMS } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const vapiCallId = message.call?.id
    const transcript = message.artifact?.transcript || ''
    const recordingUrl = message.artifact?.recordingUrl || null
    const durationSeconds = Math.round(message.durationSeconds || 0)
    const callerNumber = message.call?.customer?.number || 'unknown'
    const assistantId = message.call?.assistantId

    // Try to get org ID from metadata first (set by Twilio webhook)
    // This is the reliable path — org ID was passed when the call started
    const metadataOrgId = message.call?.metadata?.organizationId

    console.log(`📞 Vapi webhook: callId=${vapiCallId} caller=${callerNumber} duration=${durationSeconds}s orgFromMeta=${metadataOrgId}`)

    const db = createServiceClient() as any

    // Resolve organization ID — three fallback methods in order of reliability
    let organizationId: string | null = null

    // Method 1: org ID passed directly in metadata (most reliable — set by Twilio webhook)
    if (metadataOrgId) {
      organizationId = metadataOrgId
      console.log(`✅ Org resolved from metadata: ${organizationId}`)
    }

    // Method 2: find existing call record created by Twilio webhook
    if (!organizationId && vapiCallId) {
      const { data: callRecord } = await db
        .from('calls')
        .select('organization_id')
        .eq('vapi_call_id', vapiCallId)
        .single()
      if (callRecord?.organization_id) {
        organizationId = callRecord.organization_id
        console.log(`✅ Org resolved from call record: ${organizationId}`)
      }
    }

    // Method 3: look up org by assistant ID (works for direct Vapi test calls)
    if (!organizationId && assistantId) {
      const { data: aiConfig } = await db
        .from('organization_ai_configs')
        .select('organization_id')
        .eq('vapi_assistant_id', assistantId)
        .single()
      if (aiConfig?.organization_id) {
        organizationId = aiConfig.organization_id
        console.log(`✅ Org resolved from assistant ID: ${organizationId}`)
      }
    }

    if (!organizationId) {
      console.error('❌ Could not resolve organization for call')
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Find or create call record
    let callId: string

    const { data: existingCall } = await db
      .from('calls')
      .select('id')
      .eq('vapi_call_id', vapiCallId)
      .single()

    if (existingCall) {
      callId = existingCall.id
      await db.from('calls').update({
        recording_url: recordingUrl,
        duration_seconds: durationSeconds,
        status: 'completed',
        ended_at: new Date().toISOString()
      }).eq('id', callId)
    } else {
      const { data: newCall } = await db.from('calls').insert({
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
      }).select('id').single()
      callId = newCall.id
    }

    // Save recording
    if (recordingUrl) {
      await db.from('recordings').insert({
        organization_id: organizationId,
        call_id: callId,
        url: recordingUrl,
        duration_seconds: durationSeconds
      }).catch(console.error)
    }

    // Save transcript
    if (transcript) {
      await db.from('transcripts').insert({
        organization_id: organizationId,
        call_id: callId,
        content: transcript,
        content_structured: message.artifact?.messages || null,
        word_count: transcript.split(' ').length
      }).catch(console.error)
    }

    // Run AI pipeline if transcript is long enough to analyse
    if (transcript && transcript.length > 50) {
      const { data: practiceAreas } = await db
        .from('practice_areas')
        .select('name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      const practiceAreaNames = (practiceAreas || []).map((p: any) => p.name)

      const aiResult = await processCallWithAI(transcript, organizationId, callId, practiceAreaNames)
      const { leadId } = await findOrCreateLead(organizationId, callerNumber, aiResult.callerName, aiResult)

      await db.from('calls').update({ lead_id: leadId }).eq('id', callId)
      await saveAIResults(aiResult, organizationId, callId, leadId)
      await createAutoTasks(organizationId, leadId, callId, aiResult)

      // Notifications for urgent leads
      if (aiResult.leadQuality === 'critical' || aiResult.sentiment === 'distressed') {
        const { data: orgUsers } = await db.from('users').select('id').eq('organization_id', organizationId)
        for (const user of orgUsers || []) {
          await db.from('notifications').insert({
            organization_id: organizationId,
            user_id: user.id,
            lead_id: leadId,
            call_id: callId,
            title: '🚨 Urgent lead requires immediate attention',
            message: `${aiResult.callerName || callerNumber} — ${aiResult.practiceArea}. ${aiResult.recommendation}`,
            type: 'urgent',
            channel: 'in_app'
          }).catch(console.error)
        }
      }

      // Email summary to firm
      const { data: settings } = await db.from('organization_settings').select('*').eq('organization_id', organizationId).single()
      const { data: org } = await db.from('organizations').select('name').eq('id', organizationId).single()

      if (settings?.auto_email_enabled && settings?.notification_email) {
        await sendCallSummaryEmail(
          [settings.notification_email],
          org?.name || 'The firm',
          callerNumber,
          aiResult,
          durationSeconds
        ).catch(console.error)
      }

      // SMS to caller
      if (settings?.auto_sms_enabled && callerNumber !== 'unknown') {
        await sendConfirmationSMS(
          callerNumber,
          org?.name || 'The firm',
          settings?.callback_promise_hours || 2,
          settings?.sms_confirmation_template
        ).catch(console.error)
      }

      console.log(`✅ Call processed: org=${organizationId} call=${callId} lead=${leadId} quality=${aiResult.leadQuality}`)
      return NextResponse.json({ success: true, callId, leadId, organizationId })
    }

    console.log(`⚠️ Call ${callId} had no transcript — saved but not analysed`)
    return NextResponse.json({ success: true, callId, organizationId, note: 'No transcript' })

  } catch (error: any) {
    console.error('Vapi webhook error:', error)
    return NextResponse.json({ error: 'Processing failed', detail: error.message }, { status: 500 })
  }
}
