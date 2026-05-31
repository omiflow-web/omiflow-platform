import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Clock, Calendar, MessageSquare } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export default async function LeadProfilePage({ params }: { params: { id: string } }) {
  const supabase = createServerClientInstance(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = (userData as any)?.organization_id

  const { data: lead } = await supabase
    .from('leads')
    .select('*, practice_area:practice_areas(*), assigned_staff:staff_members(*)')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!lead) notFound()

  // Get all calls for this lead
  const { data: calls } = await supabase
    .from('calls')
    .select('*, summaries(content), sentiment_scores(sentiment), lead_scores(quality)')
    .eq('lead_id', lead.id)
    .order('started_at', { ascending: false })

  // Get tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  // Get appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('lead_id', lead.id)
    .order('starts_at', { ascending: true })

  // Get communications
  const { data: communications } = await supabase
    .from('communications')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
  const practiceArea = (lead as any).practice_area
  const assignedStaff = (lead as any).assigned_staff

  // Build unified timeline
  const timeline = [
    ...(calls || []).map(c => ({ type: 'call', date: c.started_at, data: c })),
    ...(communications || []).filter(c => c.type !== 'call').map(c => ({ type: c.type, date: c.created_at, data: c })),
    ...(appointments || []).map(a => ({ type: 'appointment', date: a.starts_at, data: a }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <a href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </a>

      {/* Lead Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
              {lead.first_contact_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  First contact {formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium priority-${lead.priority}`}>
              {lead.priority}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium status-${lead.status}`}>
              {lead.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Lead meta */}
        <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-400 mb-1">Practice Area</div>
            {practiceArea ? (
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: practiceArea.color }} />
                {practiceArea.name}
              </div>
            ) : <span className="text-sm text-gray-400">Not set</span>}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Assigned To</div>
            <div className="text-sm font-medium text-gray-900">
              {assignedStaff ? `${assignedStaff.first_name} ${assignedStaff.last_name}` : 'Unassigned'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Total Calls</div>
            <div className="text-sm font-medium text-gray-900">{calls?.length || 0}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Tasks</h2>
            <div className="space-y-3">
              {tasks && tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    task.priority === 'urgent' ? 'bg-red-400' :
                    task.priority === 'high' ? 'bg-orange-400' :
                    'bg-gray-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900">{task.title}</div>
                    {task.due_at && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Due {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{task.status}</span>
                </div>
              )) : (
                <p className="text-xs text-gray-400">No tasks</p>
              )}
            </div>
          </div>

          {/* Appointments */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Appointments</h2>
            {appointments && appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map(apt => (
                  <div key={apt.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-900">{apt.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{format(new Date(apt.starts_at), 'PPp')}</div>
                    <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded font-medium ${
                      apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{apt.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No appointments</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Notes</h2>
            <p className="text-sm text-gray-600">{lead.notes || 'No notes yet'}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-5">Timeline</h2>
          <div className="space-y-4">
            {timeline.length > 0 ? timeline.map((item, i) => {
              const isCall = item.type === 'call'
              const isSMS = item.type === 'sms'
              const isEmail = item.type === 'email'
              const isAppt = item.type === 'appointment'
              const call = isCall ? item.data as any : null
              const summary = call?.summaries?.[0]?.content
              const sentiment = call?.sentiment_scores?.[0]?.sentiment

              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCall ? 'bg-purple-100' :
                      isSMS ? 'bg-blue-100' :
                      isEmail ? 'bg-green-100' :
                      'bg-orange-100'
                    }`}>
                      {isCall && <Phone className="w-3.5 h-3.5 text-purple-600" />}
                      {isSMS && <MessageSquare className="w-3.5 h-3.5 text-blue-600" />}
                      {isEmail && <Mail className="w-3.5 h-3.5 text-green-600" />}
                      {isAppt && <Calendar className="w-3.5 h-3.5 text-orange-600" />}
                    </div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-2 min-h-4" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700 capitalize">
                        {isCall ? `${call?.handled_by === 'ai' ? '🤖 AI' : '👤 Human'} Call` :
                         isSMS ? '📱 SMS' :
                         isEmail ? '📧 Email' :
                         `📅 ${(item.data as any).type}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                      </span>
                    </div>
                    {summary && <p className="text-xs text-gray-600">{summary}</p>}
                    {sentiment && (
                      <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment}`}>
                        {sentiment}
                      </span>
                    )}
                    {isSMS && <p className="text-xs text-gray-600">{(item.data as any).content}</p>}
                    {isAppt && <p className="text-xs text-gray-600">{(item.data as any).title} — {format(new Date(item.date), 'PPp')}</p>}
                    {isCall && call?.id && (
                      <a href={`/dashboard/calls/${call.id}`} className="text-xs text-omiflow-600 hover:underline mt-1 block">
                        View call details →
                      </a>
                    )}
                  </div>
                </div>
              )
            }) : (
              <p className="text-sm text-gray-400">No activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
