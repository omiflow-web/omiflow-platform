'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'

const statusConfig: Record<string, { label: string; class: string }> = {
  new: { label: 'New', class: 'status-new' },
  contacted: { label: 'Contacted', class: 'status-contacted' },
  consultation_scheduled: { label: 'Consultation Booked', class: 'status-consultation_scheduled' },
  consultation_completed: { label: 'Consultation Done', class: 'bg-blue-100 text-blue-700' },
  retained: { label: 'Retained', class: 'status-retained' },
  lost: { label: 'Lost', class: 'status-lost' },
  not_interested: { label: 'Not Interested', class: 'status-lost' }
}

const callTypeBadge: Record<string, { label: string; class: string }> = {
  complaint: { label: 'Complaint', class: 'bg-red-100 text-red-700' },
  existing_client: { label: 'Existing Client', class: 'bg-blue-100 text-blue-700' },
  wrong_number: { label: 'Wrong Number', class: 'bg-gray-100 text-gray-500' },
  supplier: { label: 'Supplier', class: 'bg-gray-100 text-gray-500' },
  other: { label: 'Other', class: 'bg-gray-100 text-gray-600' },
}

export default function LeadsClient({
  initialLeads, counts, searchParams, isOwner, showDeleted, orgId
}: {
  initialLeads: any[]
  counts: Record<string, number>
  searchParams: any
  isOwner: boolean
  showDeleted: boolean
  orgId: string
}) {
  const [leads, setLeads] = useState(initialLeads)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function softDelete(leadId: string) {
    setDeleting(leadId)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, is_deleted: true, deleted_at: new Date().toISOString() })
    })
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setConfirmDelete(null)
    setDeleting(null)
  }

  async function restore(leadId: string) {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, is_deleted: false, deleted_at: null })
    })
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  async function permanentDelete(leadId: string) {
    if (!confirm('Permanently delete this lead? This cannot be undone.')) return
    await fetch(`/api/leads?leadId=${leadId}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== leadId))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Remove this lead?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              This lead will be moved to the deleted leads section. {isOwner ? 'You can permanently delete it from there.' : 'Only the account owner can permanently delete it.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => softDelete(confirmDelete)}
                disabled={deleting === confirmDelete}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting === confirmDelete ? 'Removing...' : 'Remove Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{showDeleted ? 'Deleted Leads' : 'Leads'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} {showDeleted ? 'deleted' : 'total'} leads</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <a href={showDeleted ? '/dashboard/leads' : '/dashboard/leads?deleted=true'}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              {showDeleted ? '← Back to Leads' : <><Trash2 className="w-4 h-4" /> Deleted Leads</>}
            </a>
          )}
        </div>
      </div>

      {!showDeleted && (
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
          {Object.entries(statusConfig).map(([status, config]) => (
            <a key={status} href={`/dashboard/leads?status=${status}`}
              className={`bg-white rounded-xl border border-gray-100 p-3 text-center hover:border-omiflow-200 transition-colors ${searchParams.status === status ? 'border-omiflow-300 bg-omiflow-50' : ''}`}>
              <div className="text-lg font-bold text-gray-900">{counts[status] || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-tight">{config.label}</div>
            </a>
          ))}
          <a href="/dashboard/leads"
            className={`bg-white rounded-xl border border-gray-100 p-3 text-center hover:border-omiflow-200 transition-colors ${!searchParams.status ? 'border-omiflow-300 bg-omiflow-50' : ''}`}>
            <div className="text-lg font-bold text-gray-900">{leads.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">All</div>
          </a>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <form>
          <input name="q" defaultValue={searchParams.q}
            placeholder="Search by name, phone or email..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Lead</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Priority</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Practice Area</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">First Contact</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead: any) => {
                const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
                const practiceArea = lead.practice_area
                const statusCfg = statusConfig[lead.status] || { label: lead.status, class: 'bg-gray-100 text-gray-500' }
                const isUrgent = lead.status === 'new' && lead.priority === 'critical' && !showDeleted
                const callType = lead.tags?.[0]
                const callTypeCfg = callType && callTypeBadge[callType]

                return (
                  <tr key={lead.id} className={`hover:bg-gray-50 ${isUrgent ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                        <div>
                          <div className="font-medium text-gray-900">{name}</div>
                          <div className="text-gray-400 text-xs">{lead.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {callTypeCfg ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${callTypeCfg.class}`}>
                          {callTypeCfg.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Enquiry</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.class}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium priority-${lead.priority}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {practiceArea && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: practiceArea.color }} />
                          <span className="text-gray-700">{practiceArea.name}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {lead.first_contact_at ? formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {!showDeleted && (
                          <a href={`/dashboard/leads/${lead.id}`} className="text-omiflow-600 hover:underline text-xs font-medium">
                            View →
                          </a>
                        )}
                        {!showDeleted && (
                          <button onClick={() => setConfirmDelete(lead.id)}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Remove lead">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {showDeleted && (
                          <button onClick={() => restore(lead.id)}
                            className="text-xs text-omiflow-600 hover:underline font-medium flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        )}
                        {showDeleted && isOwner && (
                          <button onClick={() => permanentDelete(lead.id)}
                            className="text-xs text-red-600 hover:underline font-medium">
                            Delete Forever
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {leads.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              {showDeleted ? 'No deleted leads' : 'No leads found'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
