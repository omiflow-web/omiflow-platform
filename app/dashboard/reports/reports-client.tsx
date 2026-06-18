'use client'

import { useState } from 'react'

const STATUS_LABELS: Record<string,string> = {
  new_enquiry:'New', contacted:'Contacted', consultation_requested:'Consultation Requested',
  consultation_booked:'Consultation Booked', consultation_completed:'Consultation Completed',
  proposal_sent:'Proposal Sent', active_opportunity:'Active', customer:'Customer',
  lost:'Lost', not_suitable:'Not Suitable'
}
const REASON_LABELS: Record<string,string> = {
  chose_competitor:'Chose competitor', not_interested:'Not interested', no_response:'No response',
  price:'Price', not_suitable:'Not suitable', other:'Other'
}

export default function ReportsClient({ recent, all }: any) {
  const [tab, setTab] = useState<'overview'|'recovery'|'conversion'|'opportunity'>('overview')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'recovery', label: 'Recovery Report' },
    { id: 'conversion', label: 'Conversion' },
    { id: 'opportunity', label: 'Opportunities' },
  ]

  return (
    <div className="space-y-6 px-4 pt-4 md:px-0 pb-24 md:pb-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Reports</h1>
        <p className="text-xs text-gray-500 mt-1 md:text-sm">Grounded in your actual data — no estimates or forecasts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview all={all} />}
      {tab === 'recovery' && <Recovery recent={recent} />}
      {tab === 'conversion' && <Conversion all={all} />}
      {tab === 'opportunity' && <OpportunityReport all={all} />}
    </div>
  )
}

function Stat({ label, value }: any) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-lg font-bold text-gray-900 tabular-nums">{value}</span>
    </div>
  )
}

function Card({ title, sub, children }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// OVERVIEW — all-time pipeline snapshot (the original data view)
function Overview({ all }: any) {
  const byStatus: Record<string, number> = {}
  for (const o of all) byStatus[o.status] = (byStatus[o.status] || 0) + 1
  const total = all.length
  const customers = all.filter((o: any) => o.outcome === 'customer').length
  const active = all.filter((o: any) => o.outcome === 'still_active').length
  const lost = all.filter((o: any) => o.outcome === 'lost' || o.outcome === 'not_suitable').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat label="Total enquiries" value={total} />
        <BigStat label="Still active" value={active} tone="indigo" />
        <BigStat label="Customers" value={customers} tone="green" />
        <BigStat label="Lost" value={lost} tone="gray" />
      </div>
      <Card title="Pipeline by stage" sub="Every enquiry, all time">
        <div className="divide-y divide-gray-50">
          {Object.keys(STATUS_LABELS).filter(s => byStatus[s]).map(s => (
            <Stat key={s} label={STATUS_LABELS[s]} value={byStatus[s] || 0} />
          ))}
          {total === 0 && <div className="px-5 py-8 text-center text-xs text-gray-300">No enquiries yet</div>}
        </div>
      </Card>
    </div>
  )
}

function BigStat({ label, value, tone }: any) {
  const tones: Record<string,string> = {
    indigo:'text-indigo-700', green:'text-green-700', gray:'text-gray-500', default:'text-gray-900'
  }
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className={`text-2xl font-bold ${tones[tone] || tones.default}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

// RECOVERY REPORT — 30 day, factual
function Recovery({ recent }: any) {
  const list = recent
  const total = list.length
  const contacted = list.filter((o: any) => o.status !== 'new_enquiry').length
  const notContacted = list.filter((o: any) => o.status === 'new_enquiry').length
  const consultationRequested = list.filter((o: any) => ['consultation_requested','consultation_booked','consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const consultationBooked = list.filter((o: any) => ['consultation_booked','consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const consultationCompleted = list.filter((o: any) => ['consultation_completed','proposal_sent','active_opportunity','customer'].includes(o.status)).length
  const stillActive = list.filter((o: any) => o.outcome === 'still_active').length
  const noFollowUp = list.filter((o: any) => (o.follow_up_count || 0) === 0 && o.status !== 'new_enquiry').length
  const stalled = list.filter((o: any) => o.is_stalled).length
  const customers = list.filter((o: any) => o.outcome === 'customer').length
  const lost = list.filter((o: any) => o.outcome === 'lost' || o.outcome === 'not_suitable').length
  const activeNoAction = list.filter((o: any) => o.outcome === 'still_active' && !o.next_action_date).length

  const obs: string[] = []
  if (notContacted > 0) obs.push(`${notContacted} ${notContacted === 1 ? 'enquiry has' : 'enquiries have'} been received but not yet contacted.`)
  if (consultationRequested > consultationBooked) obs.push(`${consultationRequested - consultationBooked} ${consultationRequested - consultationBooked === 1 ? 'enquiry' : 'enquiries'} reached the consultation-requested stage but did not progress to a booking.`)
  if (noFollowUp > 0) obs.push(`${noFollowUp} ${noFollowUp === 1 ? 'enquiry has' : 'enquiries have'} had initial contact but no recorded follow-up.`)
  if (stalled > 0) obs.push(`${stalled} ${stalled === 1 ? 'enquiry is' : 'enquiries are'} currently stalled with no recent activity.`)
  if (activeNoAction > 0) obs.push(`${activeNoAction} active ${activeNoAction === 1 ? 'enquiry has' : 'enquiries have'} no next action scheduled.`)
  if (obs.length === 0) obs.push('No issues detected in this period. Every enquiry has been actioned and has a clear next step.')

  const metrics = [
    ['Total enquiries received', total], ['Contacted', contacted], ['Not contacted', notContacted],
    ['Requested a consultation', consultationRequested], ['Consultations booked', consultationBooked],
    ['Consultations completed', consultationCompleted], ['Still active', stillActive],
    ['No follow-up recorded', noFollowUp], ['Stalled', stalled], ['Became customers', customers],
    ['Lost or not suitable', lost]
  ]

  return (
    <div className="space-y-5">
      <Card title="The numbers" sub="Enquiries created in the last 30 days">
        <div className="divide-y divide-gray-50">
          {metrics.map(([l, v]: any) => <Stat key={l} label={l} value={v} />)}
        </div>
      </Card>
      <Card title="Observations" sub="Based only on your actual data — no estimates or forecasts">
        <div className="p-5 space-y-3">
          {obs.map((o, i) => (
            <div key={i} className="flex gap-2.5 text-sm text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
              <span>{o}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// CONVERSION — where things end up
function Conversion({ all }: any) {
  const total = all.length
  const customers = all.filter((o: any) => o.outcome === 'customer').length
  const lost = all.filter((o: any) => o.outcome === 'lost').length
  const notSuitable = all.filter((o: any) => o.outcome === 'not_suitable').length

  // Reason lost breakdown
  const reasons: Record<string, number> = {}
  for (const o of all.filter((o: any) => o.outcome === 'lost')) {
    const r = o.reason_lost || 'unspecified'
    reasons[r] = (reasons[r] || 0) + 1
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <BigStat label="Became customers" value={customers} tone="green" />
        <BigStat label="Lost" value={lost} tone="gray" />
        <BigStat label="Not suitable" value={notSuitable} tone="gray" />
      </div>
      <Card title="Why opportunities were lost" sub="Recorded reasons only">
        <div className="divide-y divide-gray-50">
          {Object.keys(reasons).length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-gray-300">No lost opportunities recorded yet</div>
          ) : Object.entries(reasons).map(([r, c]) => (
            <Stat key={r} label={REASON_LABELS[r] || 'Unspecified'} value={c as number} />
          ))}
        </div>
      </Card>
    </div>
  )
}

// OPPORTUNITY REPORT — priority + source breakdown
function OpportunityReport({ all }: any) {
  const bySource: Record<string, number> = {}
  for (const o of all) { const s = o.source || 'unknown'; bySource[s] = (bySource[s] || 0) + 1 }
  const byPriority: Record<string, number> = {}
  for (const o of all) { const p = o.priority || 'medium'; byPriority[p] = (byPriority[p] || 0) + 1 }

  return (
    <div className="space-y-5">
      <Card title="By source" sub="Where enquiries come from">
        <div className="divide-y divide-gray-50">
          {Object.entries(bySource).map(([s, c]) => (
            <Stat key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={c as number} />
          ))}
          {all.length === 0 && <div className="px-5 py-8 text-center text-xs text-gray-300">No data yet</div>}
        </div>
      </Card>
      <Card title="By priority">
        <div className="divide-y divide-gray-50">
          {['urgent','high','medium','low'].filter(p => byPriority[p]).map(p => (
            <Stat key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} value={byPriority[p]} />
          ))}
        </div>
      </Card>
    </div>
  )
}
