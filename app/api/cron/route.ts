import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendStaffNotificationEmail } from '@/lib/email'
import { sendStaffSMS } from '@/lib/twilio'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient() as any
  const results = {
    orgs_processed: 0,
    overdue_alerts: 0,
    escalations: 0,
    consultation_reminders: 0,
    missed_consultation_tasks: 0,
    reengagement_tasks: 0
  }

  try {
    const { data: orgs } = await db
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)

    for (const org of orgs || []) {
      const { data: settings } = await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id', org.id)
        .single()

      if (!settings) continue

      const callbackHours = settings.callback_promise_hours || 2
      const escalationHours = settings.escalation_hours || 24

      // ── Rule 1: Lead not contacted in callback_hours → alert staff ──
      const callbackThreshold = new Date()
      callbackThreshold.setHours(callbackThreshold.getHours() - callbackHours)

      const { data: overdueLeads } = await db
        .from('leads')
        .select('id, first_name, last_name, phone, priority')
        .eq('organization_id', org.id)
        .eq('status', 'new')
        .lt('created_at', callbackThreshold.toISOString())

      for (const lead of overdueLeads || []) {
        const { data: existing } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', lead.id)
          .eq('trigger_rule', 'overdue_callback')
          .eq('status', 'pending')
          .single()

        if (!existing) {
          const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone

          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: lead.id,
            title: `⚠️ Overdue callback — ${leadName}`,
            description: `Waiting over ${callbackHours} hours without contact.`,
            type: 'callback',
            priority: 'high',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'overdue_callback'
          })

          // Notify all org users in-app
          const { data: orgUsers } = await db.from('users').select('id').eq('organization_id', org.id)
          for (const user of orgUsers || []) {
            await db.from('notifications').insert({
              organization_id: org.id,
              user_id: user.id,
              lead_id: lead.id,
              title: `⚠️ Overdue callback — ${leadName}`,
              message: `${leadName} has been waiting over ${callbackHours} hours for a callback.`,
              type: 'warning',
              channel: 'in_app'
            })
          }

          if (settings.notification_email) {
            await sendStaffNotificationEmail(
              settings.notification_email,
              `Overdue Callback — ${leadName}`,
              `${leadName} has been waiting over ${callbackHours} hours.\nPhone: ${lead.phone}`,
              org.name
            ).catch(console.error)
          }

          results.overdue_alerts++
        }
      }

      // ── Rule 2: Lead inactive escalation_hours → escalate + mark critical ──
      const escalationThreshold = new Date()
      escalationThreshold.setHours(escalationThreshold.getHours() - escalationHours)

      const { data: escalationLeads } = await db
        .from('leads')
        .select('id, first_name, last_name, phone, priority')
        .eq('organization_id', org.id)
        .in('status', ['new', 'contacted'])
        .lt('created_at', escalationThreshold.toISOString())

      for (const lead of escalationLeads || []) {
        const { data: existing } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', lead.id)
          .eq('trigger_rule', 'escalation')
          .single()

        if (!existing) {
          const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone

          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: lead.id,
            title: `🚨 ESCALATION — ${leadName} — ${escalationHours}h without contact`,
            description: `Lead has been inactive for over ${escalationHours} hours. Immediate action required.`,
            type: 'escalation',
            priority: 'urgent',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'escalation'
          })

          await db.from('leads').update({ priority: 'critical' }).eq('id', lead.id)

          // Send SMS to notification phone if set
          if (settings.notification_phone) {
            await sendStaffSMS(
              settings.notification_phone,
              `🚨 ESCALATION — ${org.name}: ${leadName} has not been contacted in ${escalationHours} hours. Phone: ${lead.phone}`
            ).catch(console.error)
          }

          // Urgent in-app notification
          const { data: orgUsers } = await db.from('users').select('id').eq('organization_id', org.id)
          for (const user of orgUsers || []) {
            await db.from('notifications').insert({
              organization_id: org.id,
              user_id: user.id,
              lead_id: lead.id,
              title: `🚨 Escalation — ${leadName}`,
              message: `${leadName} has not been contacted in ${escalationHours} hours. This lead is now critical.`,
              type: 'urgent',
              channel: 'in_app'
            })
          }

          results.escalations++
        }
      }

      // ── Rule 3: Consultation reminder — 24h before appointment ──
      const reminderWindowStart = new Date()
      reminderWindowStart.setHours(reminderWindowStart.getHours() + 23)
      const reminderWindowEnd = new Date()
      reminderWindowEnd.setHours(reminderWindowEnd.getHours() + 25)

      const { data: upcomingAppointments } = await db
        .from('appointments')
        .select('*, lead:leads(first_name, last_name, phone)')
        .eq('organization_id', org.id)
        .eq('status', 'scheduled')
        .eq('reminder_sent', false)
        .gte('starts_at', reminderWindowStart.toISOString())
        .lte('starts_at', reminderWindowEnd.toISOString())

      for (const appt of upcomingAppointments || []) {
        const lead = appt.lead
        if (!lead?.phone) continue

        const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone
        const apptTime = new Date(appt.starts_at).toLocaleString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit'
        })

        // SMS reminder to lead
        await sendStaffSMS(
          lead.phone,
          `Reminder: You have a consultation with ${org.name} tomorrow at ${apptTime}. To reschedule, please call us.`
        ).catch(console.error)

        // Mark reminder sent
        await db.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)

        results.consultation_reminders++
      }

      // ── Rule 4: Missed consultation → create rescheduling task ──
      const missedThreshold = new Date()
      missedThreshold.setHours(missedThreshold.getHours() - 1)

      const { data: missedAppointments } = await db
        .from('appointments')
        .select('*, lead:leads(first_name, last_name, phone)')
        .eq('organization_id', org.id)
        .eq('status', 'scheduled')
        .lt('ends_at', missedThreshold.toISOString())

      for (const appt of missedAppointments || []) {
        const lead = appt.lead
        const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : 'Lead'

        // Mark as no-show
        await db.from('appointments').update({ status: 'no_show' }).eq('id', appt.id)

        // Create rescheduling task
        const { data: existing } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', appt.lead_id)
          .eq('trigger_rule', 'missed_consultation')
          .single()

        if (!existing && appt.lead_id) {
          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: appt.lead_id,
            title: `Reschedule missed consultation — ${leadName}`,
            description: `${leadName} missed their consultation. Contact them to rebook.`,
            type: 'follow_up',
            priority: 'high',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'missed_consultation'
          })

          // SMS to lead
          if (lead?.phone) {
            await sendStaffSMS(
              lead.phone,
              `Hi ${lead.first_name || 'there'}, we missed you for your consultation with ${org.name} today. Please call us to rebook.`
            ).catch(console.error)
          }

          results.missed_consultation_tasks++
        }
      }

      // ── Rule 5: 7-day re-engagement for cold leads ──
      const reengagementThreshold = new Date()
      reengagementThreshold.setDate(reengagementThreshold.getDate() - 7)
      const reengagementMax = new Date()
      reengagementMax.setDate(reengagementMax.getDate() - 6)

      const { data: coldLeads } = await db
        .from('leads')
        .select('id, first_name, last_name, phone')
        .eq('organization_id', org.id)
        .eq('status', 'contacted')
        .lt('last_contact_at', reengagementThreshold.toISOString())
        .gte('last_contact_at', reengagementMax.toISOString())

      for (const lead of coldLeads || []) {
        const { data: existing } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', lead.id)
          .eq('trigger_rule', 'reengagement')
          .single()

        if (!existing) {
          const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone

          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: lead.id,
            title: `Re-engage ${leadName} — 7 days inactive`,
            description: `This lead has not been contacted in 7 days. Consider following up to keep them warm.`,
            type: 'follow_up',
            priority: 'medium',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'reengagement'
          })

          results.reengagement_tasks++
        }
      }

      results.orgs_processed++
    }

    console.log('✅ Cron complete:', results)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results })
  } catch (error: any) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Cron failed', detail: error.message }, { status: 500 })
  }
}
