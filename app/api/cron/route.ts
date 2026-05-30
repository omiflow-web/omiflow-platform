import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendStaffNotificationEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const db = supabase as any
  const results = { processed: 0, notifications: 0, escalations: 0 }

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

      // Rule 1: Lead not contacted in callback_hours
      const callbackThreshold = new Date()
      callbackThreshold.setHours(callbackThreshold.getHours() - callbackHours)

      const { data: overdueLeads } = await db
        .from('leads')
        .select('id, first_name, last_name, phone, priority, practice_area_id')
        .eq('organization_id', org.id)
        .eq('status', 'new')
        .lt('created_at', callbackThreshold.toISOString())

      for (const lead of overdueLeads || []) {
        const { data: existingTask } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', lead.id)
          .eq('trigger_rule', 'overdue_callback')
          .eq('status', 'pending')
          .single()

        if (!existingTask) {
          const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone

          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: lead.id,
            title: `⚠️ Overdue callback — ${leadName}`,
            description: `This lead has been waiting over ${callbackHours} hours without contact.`,
            type: 'callback',
            priority: 'high',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'overdue_callback'
          })

          if (settings.notification_email) {
            await sendStaffNotificationEmail(
              settings.notification_email,
              `Overdue Callback — ${leadName}`,
              `${leadName} has been waiting over ${callbackHours} hours for a callback.\n\nPhone: ${lead.phone}`,
              org.name
            )
          }

          results.notifications++
        }
      }

      // Rule 2: Lead not contacted in escalation_hours
      const escalationThreshold = new Date()
      escalationThreshold.setHours(escalationThreshold.getHours() - escalationHours)

      const { data: escalationLeads } = await db
        .from('leads')
        .select('id, first_name, last_name, phone, priority')
        .eq('organization_id', org.id)
        .in('status', ['new', 'contacted'])
        .lt('created_at', escalationThreshold.toISOString())

      for (const lead of escalationLeads || []) {
        const { data: existingEscalation } = await db
          .from('tasks')
          .select('id')
          .eq('organization_id', org.id)
          .eq('lead_id', lead.id)
          .eq('trigger_rule', 'escalation')
          .single()

        if (!existingEscalation) {
          const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone

          await db.from('tasks').insert({
            organization_id: org.id,
            lead_id: lead.id,
            title: `🚨 ESCALATION — ${leadName} — ${escalationHours}h without contact`,
            description: `This lead has been inactive for over ${escalationHours} hours.`,
            type: 'escalation',
            priority: 'urgent',
            status: 'pending',
            due_at: new Date().toISOString(),
            is_auto_generated: true,
            trigger_rule: 'escalation'
          })

          await db.from('leads').update({ priority: 'critical' }).eq('id', lead.id)

          results.escalations++
        }
      }

      results.processed++
    }

    console.log('✅ Cron complete:', results)
    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
