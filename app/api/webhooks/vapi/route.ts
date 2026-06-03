import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { processCallWithAI, saveAIResults, findOrCreateLead, createAutoTasks } from '@/lib/ai-pipeline'
import { sendCallSummaryEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message } = body

    // Acknowledge all non end-of-call events immediately
    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const vapiCallId = message.call?.id
    const durationSeconds = Math.round(message.durationSeconds || 0)
    const callerNumber = message.call?.customer?.number || 'unknown'
    const assistantId = message.call?.assistantId
    const metadataOrgId = message.call?.metadata?.organizationId
    const recordingUrl = message.artifact?.recordingUrl || null

    // Extract transcript — Vapi can send it in different fields
    let transcript = ''
    if (message.artifact?.transcript && message.artifact.transcript.length > 0) {
      transcript = message.artifact.transcript
    } else if (message.artifact?.messages && Array.isArray(message.artifact.messages)) {
      // Build transcript from messages array
      transcript = message.artifact.messages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.message || m.content || ''}`)
        .join('\n')
    }

    console.log(`📞 Vapi end-of-call: id=${vapiCallId} caller=${callerNumber} duration=${durationSeconds}s transcriptLength=${transcript.length}`)

    const db = createServiceClient() as any

    // Resolve which organisation this call belongs to
    let organizationId: string | null = null

    // Method 1: passed in metadata by Twilio webhook
    if (metadataOrgId) {
      organizationId = metadataOrgId
      console.log(`✅ Org from metadata: ${organizationId}`)
    }

    // Method 2: existing call record linked via vapi call id
    if (!organizationId && vapiCallId) {
      const { data: callRecord } = await db
        .from('calls')
        .select('organization_id')
        .eq('vapi_call_id', vapiCallId)
        .single()
      if (callRecord?.organization_id) {
        organizationId = callRecord.organization_id
        console.log(`✅ Org from call record: ${organizationId}`)
      }
    }

    // Method 3: look up by assistant ID
    if (!organizationId && assistantId) {
      const { data: aiConfig } = await db
        .from('organization_ai_configs')
        .select('organization_id')
        .eq('vapi_assistant_id', assistantId)
        .single()
      if (aiConfig?.organization_id) {
        organizationId = aiConfig.organization_id
        console.log(`✅ Org from assistant ID: ${organizationId}`)
      }
    }

    if (!organizationId) {
      console.error('❌ Could not resolve organization')
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

    console.log(`💾 Call record: ${callId}`)

    // Save recording
    if (recordingUrl) {
      try {
        await db.from('recordings').insert({
          organization_id: organizationId,
          call_id: callId,
          url: recordingUrl,
          duration_seconds: durationSeconds
        })
      } catch (e) { console.error('Recording save error:', e) }
    }

    // Save transcript
    if (transcript && transcript.length > 0) {
      try {
        await db.from('transcripts').insert({
          organization_id: organizationId,
          call_id: callId,
          content: transcript,
          content_structured: message.artifact?.messages || null,
          word_count: transcript.split(' ').length
        })
        console.log(`📝 Transcript saved: ${transcript.length} chars`)
      } catch (e) { console.error('Transcript save error:', e) }
    }

    // Run full AI pipeline — even on short transcripts, Claude handles it
    if (transcript && transcript.length > 10) {
      console.log(`🤖 Running AI pipeline...`)

      try {
        const { data: practiceAreas } = await db
          .from('practice_areas')
          .select('name')
          .eq('organization_id', organizationId)
          .eq('is_active', true)

        const practiceAreaNames = (practiceAreas || []).map((p: any) => p.name)

        const aiResult = await processCallWithAI(transcript, organizationId, callId, practiceAreaNames)
        console.log(`🧠 AI result: callType=${aiResult.callType} quality=${aiResult.leadQuality} sentiment=${aiResult.sentiment} name=${aiResult.callerName}`)

        const { leadId } = await findOrCreateLead(organizationId, callerNumber, aiResult.callerName, aiResult)
        console.log(`👤 Lead: ${leadId}`)

        await db.from('calls').update({ lead_id: leadId }).eq('id', callId)
        await saveAIResults(aiResult, organizationId, callId, leadId)
        await createAutoTasks(organizationId, leadId, callId, aiResult)

        // Urgent in-app notifications
        if (aiResult.leadQuality === 'critical' || aiResult.sentiment === 'distressed' || aiResult.sentiment === 'urgent') {
          try {
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
              })
            }
          } catch (e) { console.error('Notification error:', e) }
        }

        // Email summary to firm
        try {
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

          if (settings?.auto_email_enabled && settings?.notification_email) {
            await sendCallSummaryEmail(
              [settings.notification_email],
              org?.name || 'The firm',
              callerNumber,
              aiResult,
              durationSeconds
            )
            console.log(`📧 Email sent to ${settings.notification_email}`)
          }
        } catch (e) { console.error('Email error:', e) }

        console.log(`✅ Pipeline complete: call=${callId} lead=${leadId} quality=${aiResult.leadQuality}`)
        return NextResponse.json({ success: true, callId, leadId, organizationId })

      } catch (pipelineError: any) {
        console.error('❌ Pipeline error:', pipelineError.message)
        return NextResponse.json({ error: 'Pipeline failed', detail: pipelineError.message }, { status: 500 })
      }
    }

    console.log(`⚠️ No transcript — call saved without analysis`)
    return NextResponse.json({ success: true, callId, organizationId })

  } catch (error: any) {
    console.error('Vapi webhook fatal error:', error)
    return NextResponse.json({ error: 'Failed', detail: error.message }, { status: 500 })
  }
}
