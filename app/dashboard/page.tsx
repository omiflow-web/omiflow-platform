import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

// Status display config
const STATUS_LABELS: Record<string, string> = {
  new_enquiry: 'New Enquiry',
  contacted: 'Contacted',
  consultation_requested: 'Consultation Requested',
  consultation_booked: 'Consultation Booked',
  consultation_completed: 'Consultation Completed',
  proposal_sent: 'Proposal Sent',
  active_opportunity: 'Active',
  customer: 'Customer',
  lost: 'Lost',
  not_suitable: 'Not Suitable'
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-indigo-100 text-indigo-700',
  low: 'bg-gray-100 text-gray-500'
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users').select('organization_id, first_name').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any
  const now = new Date()

  // Pull all live opportunities for this org (not deleted)
  const { data: allOpps } = await db
    .from('opportunities')
    .select('id, first_name, last_name, company_name, phone, email, status, priority, outcome, source, enquiry_type, next_action_date, next_action_note, last_activity_at, appointment_date, is_stalled, stalled_reason, created_at')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  const opps = allOpps || []

  // Section logic
  const newOpps = opps.filter((o: any) => o.status === 'new_enquiry')
  const activeOpps = opps.filter((o: any) =>
    ['contacted','consultation_requested','consultation_booked','consultation_completed','proposal_sent','active_opportunity'].includes(o.status)
    && o.outcome === 'still_active' && !o.is_stalled)
  const awaitingFollowUp = opps.filter((o: any) =>
    o.next_action_date && new Date(o.next_action_date) <= now && o.outcome === 'still_active')
  const appointmentsPending = opps.filter((o: any) =>
    o.appointment_date && new Date(o.appointment_date) >= now)
  const stalled = opps.filter((o: any) => o.is_stalled && o.outcome === 'still_active')
  const won = opps.filter((o: any) => o.outcome === 'customer')
  const lost = opps.filter((o: any) => o.outcome === 'lost' || o.outcome === 'not_suitable')

  const firstName = (userData as any)?.first_name || 'there'

  // What needs attention = new + awaiting follow-up + stalled
  const needsAttention = newOpps.length + awaitingFollowUp.length + stalled.length

  return (
    <div className="space-y-5 px-4 pt-4 md:px-0 md:pt-0 md:space-y-6 pb-24 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Good {timeOfDay()}, {firstName}</h1>
          <p className="text-xs text-gray-500 mt-1 md:text-sm">
            {needsAttention > 0
              ? `${needsAttention} ${needsAttention === 1 ? 'enquiry needs' : 'enquiries need'} your attention right now`
              : 'Everything is up to date — no enquiries need attention'}
          </p>
        </div>
        <Link href="/dashboard/opportunities/new"
          className="hidden md:flex items-center gap-2 bg-omiflow-600 hover:bg-omiflow-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Enquiry
        </Link>
      </div>

      {/* Attention strip */}
      {(newOpps.length > 0 || awaitingFollowUp.length > 0 || stalled.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <AttentionCard count={newOpps.length} label="New" sublabel="to action" tone="indigo" href="#new" />
          <AttentionCard count={awaitingFollowUp.length} label="Follow-ups" sublabel="due now" tone="orange" href="#followup" />
          <AttentionCard count={stalled.length} label="Stalled" sublabel="at risk" tone="red" href="#stalled" />
        </div>
      )}

      {/* SECTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <Section id="new" title="New Enquiries" subtitle="Recently entered enquiries" items={newOpps} tone="indigo" empty="No new enquiries" />
        <Section id="followup" title="Awaiting Follow-Up" subtitle="Action is due" items={awaitingFollowUp} tone="orange" empty="Nothing due right now" showAction />
        <Section id="active" title="Active Enquiries" subtitle="Currently progressing" items={activeOpps} tone="indigo" empty="No active enquiries" />
        <Section id="appointments" title="Appointments Pending" subtitle="Upcoming" items={appointmentsPending} tone="green" empty="No upcoming appointments" showAppt />
        <Section id="stalled" title="Stalled Enquiries" subtitle="Need attention — no recent activity" items={stalled} tone="red" empty="Nothing stalled" showStalled />
        <Section id="won" title="Won" subtitle="Converted to customers" items={won} tone="green" empty="No customers yet" />
      </div>

      {/* Lost — full width, muted */}
      <Section id="lost" title="Lost & Not Suitable" subtitle="Closed opportunities" items={lost} tone="gray" empty="None" fullWidth />
    </div>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function AttentionCard({ count, label, sublabel, tone, href }: any) {
  const tones: Record<string, string> = {
    indigo: 'border-indigo-200 bg-indigo-50',
    orange: 'border-orange-200 bg-orange-50',
    red: 'border-red-200 bg-red-50'
  }
  const nums: Record<string, string> = {
    indigo: 'text-indigo-700',
    orange: 'text-orange-700',
    red: 'text-red-700'
  }
  return (
    <a href={href} className={`rounded-xl border p-3 md:p-4 ${tones[tone]} transition-transform hover:scale-[1.02]`}>
      <div className={`text-2xl font-bold md:text-3xl ${nums[tone]}`}>{count}</div>
      <div className="text-xs font-medium text-gray-900 mt-1">{label}</div>
      <div className="text-[10px] text-gray-500">{sublabel}</div>
    </a>
  )
}

function Section({ id, title, subtitle, items, tone, empty, showAction, showAppt, showStalled, fullWidth }: any) {
  const dotTones: Record<string, string> = {
    indigo: 'bg-indigo-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    gray: 'bg-gray-400'
  }
  return (
    <div id={id} className={`bg-white border border-gray-100 rounded-xl overflow-hidden ${fullWidth ? 'lg:col-span-2' : ''} scroll-mt-4`}>
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotTones[tone]}`} />
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="text-[11px] text-gray-400">{subtitle}</div>
          </div>
        </div>
        <span className="text-xs font-semibold text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-[340px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-300">{empty}</div>
        ) : items.map((o: any) => (
          <OppRow key={o.id} o={o} showAction={showAction} showAppt={showAppt} showStalled={showStalled} />
        ))}
      </div>
    </div>
  )
}

function OppRow({ o, showAction, showAppt, showStalled }: any) {
  const name = [o.first_name, o.last_name].filter(Boolean).join(' ') || o.company_name || o.phone || 'Unknown'
  return (
    <Link href={`/dashboard/opportunities/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
          {o.priority && o.priority !== 'medium' && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${PRIORITY_STYLES[o.priority] || ''}`}>
              {o.priority}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5">
          {o.enquiry_type || STATUS_LABELS[o.status] || o.status}
          {showStalled && o.stalled_reason ? ` · ${o.stalled_reason}` : ''}
          {showAction && o.next_action_note ? ` · ${o.next_action_note}` : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        {showAppt && o.appointment_date ? (
          <div className="text-[11px] font-medium text-green-700">{format(new Date(o.appointment_date), 'd MMM, h:mmaaa')}</div>
        ) : (
          <div className="text-[11px] text-gray-400">
            {o.last_activity_at ? formatDistanceToNow(new Date(o.last_activity_at), { addSuffix: true }) : ''}
          </div>
        )}
      </div>
    </Link>
  )
}
