import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

const statusConfig: Record<string, { label: string; class: string }> = {
  new: { label: 'New', class: 'status-new' },
  contacted: { label: 'Contacted', class: 'status-contacted' },
  consultation_scheduled: { label: 'Consultation Booked', class: 'status-consultation_scheduled' },
  consultation_completed: { label: 'Consultation Done', class: 'bg-blue-100 text-blue-700' },
  retained: { label: 'Retained', class: 'status-retained' },
  lost: { label: 'Lost', class: 'status-lost' },
  not_interested: { label: 'Not Interested', class: 'status-lost' }
}

export default async function LeadsPage({
  searchParams
}: {
  searchParams: { status?: string; priority?: string; q?: string; filter?: string }
}) {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  let query = supabase
    .from('leads')
    .select('*, practice_area:practice_areas(name, color), assigned_staff:staff_members(first_name, last_name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.priority || searchParams.filter === 'urgent') {
    query = query.eq('priority', searchParams.priority || 'critical')
  }

  const { data: leads } = await query

  const filteredLeads = leads?.filter(lead => {
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase()
      const name = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase()
      return name.includes(q) || lead.phone.includes(q) || lead.email?.toLowerCase().includes(q)
    }
    return true
  })

  // Count by status
  const counts = leads?.reduce((acc: Record<string, number>, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads?.length || 0} total leads</p>
        </div>
      </div>

      {/* Pipeline counts */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(statusConfig).map(([status, config]) => (
          <a key={status} href={`/dashboard/leads?status=${status}`}
            className={`bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-omiflow-200 transition-colors ${searchParams.status === status ? 'border-omiflow-300 bg-omiflow-50' : ''}`}>
            <div className="text-xl font-bold text-gray-900">{counts[status] || 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">{config.label}</div>
          </a>
        ))}
        <a href="/dashboard/leads"
          className={`bg-white rounded-xl border border-gray-100 p-4 text-center hover:border-omiflow-200 transition-colors ${!searchParams.status ? 'border-omiflow-300 bg-omiflow-50' : ''}`}>
          <div className="text-xl font-bold text-gray-900">{leads?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">All</div>
        </a>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <form>
          <input name="q" defaultValue={searchParams.q}
            placeholder="Search leads by name, phone, email..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
        </form>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Lead</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Priority</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Practice Area</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Assigned To</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">First Contact</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLeads?.map(lead => {
                const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
                const practiceArea = (lead as any).practice_area
                const assignedStaff = (lead as any).assigned_staff
                const statusCfg = statusConfig[lead.status] || { label: lead.status, class: 'bg-gray-100 text-gray-500' }
                const isUrgent = lead.status === 'new' && lead.priority === 'critical'

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
                    <td className="px-6 py-4 text-gray-600">
                      {assignedStaff
                        ? `${assignedStaff.first_name} ${assignedStaff.last_name}`
                        : <span className="text-gray-300">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {lead.first_contact_at
                        ? formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <a href={`/dashboard/leads/${lead.id}`} className="text-omiflow-600 hover:underline text-xs font-medium">
                        View →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!filteredLeads || filteredLeads.length === 0) && (
            <div className="p-12 text-center text-gray-400">No leads found</div>
          )}
        </div>
      </div>
    </div>
  )
}
