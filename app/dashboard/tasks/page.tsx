import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { formatDistanceToNow, format, isPast } from 'date-fns'
import { CheckSquare, Clock, AlertTriangle } from 'lucide-react'

export default async function TasksPage({
  searchParams
}: {
  searchParams: { status?: string; priority?: string }
}) {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  let query = supabase
    .from('tasks')
    .select('*, lead:leads(first_name, last_name, phone), assigned_staff:staff_members(first_name, last_name)')
    .eq('organization_id', orgId)
    .order('due_at', { ascending: true, nullsFirst: false })

  const statusFilter = searchParams.status || 'pending'
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  if (searchParams.priority) query = query.eq('priority', searchParams.priority)

  const { data: tasks } = await query

  const overdueTasks = tasks?.filter(t => t.due_at && isPast(new Date(t.due_at)) && t.status === 'pending') || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Follow-ups, callbacks, and escalations</p>
      </div>

      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800 font-medium text-sm">{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'in_progress', 'completed', 'all'].map(s => (
          <a key={s} href={`/dashboard/tasks?status=${s}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-omiflow-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </a>
        ))}
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {tasks && tasks.length > 0 ? tasks.map(task => {
          const lead = task.lead as any
          const staff = task.assigned_staff as any
          const isOverdue = task.due_at && isPast(new Date(task.due_at)) && task.status === 'pending'
          const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : null

          return (
            <div key={task.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
              isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
            }`}>
              <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                task.status === 'completed' ? 'bg-green-500 border-green-500' :
                task.status === 'in_progress' ? 'border-omiflow-500' :
                'border-gray-300'
              }`}>
                {task.status === 'completed' && <span className="text-white text-xs">✓</span>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">{task.title}</div>
                {task.description && <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {leadName && (
                    <a href={`/dashboard/leads/${task.lead_id}`} className="text-xs text-omiflow-600 hover:underline">
                      {leadName}
                    </a>
                  )}
                  {staff && (
                    <span className="text-xs text-gray-400">→ {staff.first_name} {staff.last_name}</span>
                  )}
                  {task.is_auto_generated && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Auto</span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0 space-y-1">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
                {task.due_at && (
                  <div className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {isOverdue ? '⚠️ ' : ''}
                    {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            No tasks found
          </div>
        )}
      </div>
    </div>
  )
}
