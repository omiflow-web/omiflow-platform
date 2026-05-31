'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, Clock, AlertTriangle, Check, Plus } from 'lucide-react'
import { formatDistanceToNow, isPast } from 'date-fns'
import { createClient } from '@/lib/supabase'

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const orgId = (userData as any)?.organization_id
      if (!orgId) return

      let query = supabase
        .from('tasks')
        .select('*, lead:leads(first_name, last_name, phone), assigned_staff:staff_members(first_name, last_name)')
        .eq('organization_id', orgId)
        .order('due_at', { ascending: true, nullsFirst: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data } = await query
      setTasks(data || [])
      setLoading(false)
    }
    load()
  }, [filter])

  async function completeTask(taskId: string) {
    setCompleting(taskId)
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'completed' })
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
    }
    setCompleting(null)
  }

  const overdueTasks = tasks.filter(t => t.due_at && isPast(new Date(t.due_at)) && t.status === 'pending')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Follow-ups, callbacks, and escalations</p>
      </div>

      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800 font-medium text-sm">
            {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''} — these need immediate attention
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'in_progress', 'completed', 'all'].map(s => (
          <button key={s} onClick={() => { setFilter(s); setLoading(true) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === s ? 'bg-omiflow-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : tasks.length > 0 ? tasks.map(task => {
          const lead = task.lead as any
          const staff = task.assigned_staff as any
          const isOverdue = task.due_at && isPast(new Date(task.due_at)) && task.status === 'pending'
          const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : null

          return (
            <div key={task.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${
              isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
            }`}>
              <button
                onClick={() => task.status === 'pending' && completeTask(task.id)}
                disabled={task.status === 'completed' || completing === task.id}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'completed' ? 'bg-green-500 border-green-500' :
                  'border-gray-300 hover:border-omiflow-500 cursor-pointer'
                }`}>
                {(task.status === 'completed' || completing === task.id) && <Check className="w-3 h-3 text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {task.title}
                </div>
                {task.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>
                )}
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
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Auto</span>
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
                    {isOverdue ? '⚠️ ' : ''}{formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                  </div>
                )}
                {task.status === 'completed' && task.completed_at && (
                  <div className="text-xs text-green-600">
                    Done {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            No {filter === 'all' ? '' : filter} tasks
          </div>
        )}
      </div>
    </div>
  )
}
