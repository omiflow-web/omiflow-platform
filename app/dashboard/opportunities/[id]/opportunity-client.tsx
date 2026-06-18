'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'

const PIPELINE = [
  'new_enquiry','contacted','consultation_requested','consultation_booked',
  'consultation_completed','proposal_sent','active_opportunity','customer'
]
const STATUS_LABELS: Record<string,string> = {
  new_enquiry:'New Enquiry', contacted:'Contacted', consultation_requested:'Consultation Requested',
  consultation_booked:'Consultation Booked', consultation_completed:'Consultation Completed',
  proposal_sent:'Proposal Sent', active_opportunity:'Active Opportunity',
  customer:'Customer', lost:'Lost', not_suitable:'Not Suitable'
}
const ALL_STATUSES = [...PIPELINE, 'lost', 'not_suitable']
const PRIORITIES = ['low','medium','high','urgent']
const REASONS_LOST = [
  { v:'chose_competitor', l:'Chose competitor' },
  { v:'not_interested', l:'Not interested' },
  { v:'no_response', l:'No response' },
  { v:'price', l:'Price' },
  { v:'not_suitable', l:'Not suitable' },
  { v:'other', l:'Other' }
]
const PRIORITY_STYLES: Record<string,string> = {
  urgent:'bg-red-100 text-red-700', high:'bg-orange-100 text-orange-700',
  medium:'bg-indigo-100 text-indigo-700', low:'bg-gray-100 text-gray-500'
}

export default function OpportunityClient({ opp, team, history, calls }: any) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState(opp)

  async function patch(fields: any) {
    setSaving(true)
    setLocal({ ...local, ...fields })
    await fetch('/api/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: opp.id, ...fields })
    })
    setSaving(false)
    router.refresh()
  }

  const name = [local.first_name, local.last_name].filter(Boolean).join(' ') || local.company_name || local.phone || 'Unknown'
  const initials = (name[0] || '?').toUpperCase()
  const currentIdx = PIPELINE.indexOf(local.status)
  const nextStage = currentIdx >= 0 && currentIdx < PIPELINE.length - 1 ? PIPELINE[currentIdx + 1] : null
  const isClosed = ['customer','lost','not_suitable'].includes(local.status)

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 md:px-0 pb-24 md:pb-6 space-y-5">
      <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700">← Back to dashboard</Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{name}</h1>
            <div className="text-xs text-gray-400 mt-0.5 space-x-2">
              {local.phone && <span>{local.phone}</span>}
              {local.email && <span>· {local.email}</span>}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{STATUS_LABELS[local.status]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[local.priority]}`}>{local.priority}</span>
              {local.enquiry_type && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{local.enquiry_type}</span>}
            </div>
          </div>
        </div>
        {saving && <span className="text-xs text-gray-400 flex-shrink-0">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: pipeline + actions */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pipeline */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
              {nextStage && !isClosed && (
                <button onClick={() => patch({ status: nextStage })}
                  className="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                  Advance to {STATUS_LABELS[nextStage]} →
                </button>
              )}
            </div>
            {/* Visual pipeline */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
              {PIPELINE.map((s, i) => (
                <div key={s} className="flex items-center flex-shrink-0">
                  <div className={`h-1.5 w-8 rounded-full ${i <= currentIdx ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                </div>
              ))}
            </div>
            {/* Status dropdown */}
            <label className="text-xs text-gray-500">Set status</label>
            <select value={local.status} onChange={e => patch({ status: e.target.value })}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>

            {/* Reason lost — only when lost */}
            {local.status === 'lost' && (
              <div className="mt-3">
                <label className="text-xs text-gray-500">Reason lost</label>
                <select value={local.reason_lost || ''} onChange={e => patch({ reason_lost: e.target.value })}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select a reason…</option>
                  {REASONS_LOST.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Next action */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Next Action</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">When</label>
                <input type="datetime-local"
                  defaultValue={local.next_action_date ? local.next_action_date.slice(0,16) : ''}
                  onBlur={e => patch({ next_action_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">What</label>
                <input type="text" defaultValue={local.next_action_note || ''} placeholder="e.g. Call back to book consultation"
                  onBlur={e => patch({ next_action_note: e.target.value })}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Notes</h2>
            <textarea defaultValue={local.notes || ''} rows={4} placeholder="Add notes about this opportunity…"
              onBlur={e => patch({ notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          {/* Linked calls */}
          {calls.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Calls</h2>
              <div className="space-y-2">
                {calls.map((c: any) => (
                  <Link key={c.id} href={`/dashboard/calls/${c.id}`} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-2 rounded">
                    <span className="text-gray-700">{c.handled_by === 'ai' ? '🤖 Receptionist' : '👤 Human'}</span>
                    <span className="text-xs text-gray-400">{c.started_at ? format(new Date(c.started_at), 'd MMM, h:mmaaa') : ''}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: ownership + meta */}
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Ownership</h2>
            <label className="text-xs text-gray-500">Owner</label>
            <select value={local.owner_id || ''} onChange={e => patch({ owner_id: e.target.value || null })}
              className="w-full mt-1 mb-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Unassigned</option>
              {team.map((t: any) => (
                <option key={t.id} value={t.id}>{[t.first_name,t.last_name].filter(Boolean).join(' ') || 'Team member'}</option>
              ))}
            </select>
            <label className="text-xs text-gray-500">Priority</label>
            <select value={local.priority} onChange={e => patch({ priority: e.target.value })}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-400">Source</dt><dd className="text-gray-700">{local.source || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Created</dt><dd className="text-gray-700">{local.created_at ? format(new Date(local.created_at), 'd MMM yyyy') : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Last activity</dt><dd className="text-gray-700">{local.last_activity_at ? formatDistanceToNow(new Date(local.last_activity_at), { addSuffix: true }) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Follow-ups</dt><dd className="text-gray-700">{local.follow_up_count || 0}</dd></div>
            </dl>
          </div>

          {history.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">History</h2>
              <div className="space-y-3">
                {history.map((h: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-gray-700">{STATUS_LABELS[h.status] || h.status}</div>
                      <div className="text-gray-400">{h.created_at ? format(new Date(h.created_at), 'd MMM, h:mmaaa') : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
