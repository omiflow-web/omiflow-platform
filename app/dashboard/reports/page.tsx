import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export default async function ReportsPage() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: opps } = await db
    .from('opportunities')
    .select('id, status, outcome, is_stalled, next_action_date, follow_up_count, last_activity_at, created_at')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .gte('created_at', thirtyDaysAgo)

  const list = opps || []

  const total = list.length
  const contacted = list.filter((o: any) => o.status !== 'new_enquiry').length
  const notContacted = list.filter((o: any) => o.status === 'new_enquiry').length
  const consultationRequested = list.filter((o: any) =>
    ['consultation_requested','consultation_booked','consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const consultationBooked = list.filter((o: any) =>
    ['consultation_booked','consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const consultationCompleted = list.filter((o: any) =>
    ['consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const stillActive = list.filter((o: any) => o.outcome === 'still_active').length
  const noFollowUp = list.filter((o: any) => (o.follow_up_count || 0) === 0 && o.status !== 'new_enquiry').length
  const stalled = list.filter((o: any) => o.is_stalled).length
  const customers = list.filter((o: any) => o.outcome === 'customer').length
  const lost = list.filter((o: any) => o.outcome === 'lost' || o.outcome === 'not_suitable').length

  const observations: string[] = []
  if (notContacted > 0)
    observations.push(`${notContacted} ${notContacted === 1 ? 'enquiry has' : 'enquiries have'} been received but not yet contacted.`)
  if (consultationRequested > consultationBooked)
    observations.push(`${consultationRequested - consultationBooked} ${consultationRequested - consultationBooked === 1 ? 'enquiry' : 'enquiries'} reached the consultation-requested stage but did not progress to a booking.`)
  if (noFollowUp > 0)
    observations.push(`${noFollowUp} ${noFollowUp === 1 ? 'enquiry has' : 'enquiries have'} had initial contact but no recorded follow-up.`)
  if (stalled > 0)
    observations.push(`${stalled} ${stalled === 1 ? 'enquiry is' : 'enquiries are'} currently stalled with no recent activity.`)
  const activeNoAction = list.filter((o: any) => o.outcome === 'still_active' && !o.next_action_date).length
  if (activeNoAction > 0)
    observations.push(`${activeNoAction} active ${activeNoAction === 1 ? 'enquiry has' : 'enquiries have'} no next action scheduled.`)
  if (observations.length === 0)
    observations.push('No issues detected in this period. Every enquiry has been actioned and has a clear next step.')

  const metrics = [
    { label: 'Total enquiries received', value: total },
    { label: 'Contacted', value: contacted },
    { label: 'Not contacted', value: notContacted },
    { label: 'Requested a consultation', value: consultationRequested },
    { label: 'Consultations booked', value: consultationBooked },
    { label: 'Consultations completed', value: consultationCompleted },
    { label: 'Still active', value: stillActive },
    { label: 'No follow-up recorded', value: noFollowUp },
    { label: 'Stalled', value: stalled },
    { label: 'Became customers', value: customers },
    { label: 'Lost or not suitable', value: lost },
  ]

  return (
    <div className="space-y-6 px-4 pt-4 md:px-0 pb-24 md:pb-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Recovery Report</h1>
        <p className="text-xs text-gray-500 mt-1 md:text-sm">What happened to your enquiries over the last 30 days</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">The numbers</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-600">{m.label}</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Observations</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Based only on your actual data — no estimates or forecasts</p>
        </div>
        <div className="p-5 space-y-3">
          {observations.map((o, i) => (
            <div key={i} className="flex gap-2.5 text-sm text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
              <span>{o}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        This report reflects enquiries created in the last 30 days. It reports only what happened — it does not estimate revenue or predict outcomes.
      </p>
    </div>
  )
}
