'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Clock, Calendar, MessageSquare, Plus, Save, Check } from 'lucide-react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

const statusOptions = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  { value: 'consultation_scheduled', label: 'Consultation Booked', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'consultation_completed', label: 'Consultation Done', color: 'bg-blue-100 text-blue-700' },
  { value: 'retained', label: 'Retained', color: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-gray-100 text-gray-400' },
]

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
]

export default function LeadProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [calls, setCalls] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [communications, setCommunications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notes, setNotes] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', type: 'callback', priority: 'medium', due_at: '' })

  useEffect(() => {
    async function load() {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const orgId = (userData as any)?.organization_id
      if (!orgId) return

      const [leadRes, callsRes, tasksRes, apptRes, commRes] = await Promise.all([
        supabase.from('leads').select('*, practice_area:practice_areas(*), assigned_staff:staff_members(*)').eq('id', params.id as string).eq('organization_id', orgId).single(),
        supabase.from('calls').select('*, summaries(content), sentiment_scores(sentiment), lead_scores(quality)').eq('lead_id', params.id as string).order('started_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('lead_id', params.id as string).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').eq('lead_id', params.id as string).order('starts_at', { ascending: true }),
        supabase.from('communications').select('*').eq('lead_id', params.id as string).order('created_at', { ascending: false })
      ])

      if (leadRes.data) {
        setLead(leadRes.data)
        setNotes(leadRes.data.notes || '')
      }
      setCalls(callsRes.data || [])
      setTasks(tasksRes.data || [])
      setAppointments(apptRes.data || [])
      setCommunications(commRes.data || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  async function updateLead(updates: any) {
    setSaving(true)
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, ...updates })
    })
    if (res.ok) {
      const data = await res.json()
      setLead(data.lead)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function saveNotes() {
    await updateLead({ notes })
  }

  async function addTask() {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, ...newTask, status: 'pending' })
    })
    if (res.ok) {
      const data = await res.json()
      setTasks(prev => [data.task, ...prev])
      setShowAddTask(false)
      setNewTask({ title: '', type: 'callback', priority: 'medium', due_at: '' })
    }
  }

  async function completeTask(taskId: string) {
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'completed' })
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t))
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>
  if (!lead) return <div className="p-8 text-gray-500">Lead not found</div>

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
  const practiceArea = lead.practice_area
  const currentStatus = statusOptions.find(s => s.value === lead.status)
  const currentPriority = priorityOptions.find(p => p.value === lead.priority)

  const timeline = [
    ...calls.map((c: any) => ({ type: 'call', date: c.started_at, data: c })),
    ...communications.filter((c: any) => c.type !== 'call').map((c: any) => ({ type: c.type, date: c.created_at, data: c })),
    ...appointments.map((a: any) => ({ type: 'appointment', date: a.starts_at, data: a }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <a href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </a>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <Check className="w-4 h-4" /> Saved
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{name}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
              {lead.first_contact_at && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />
                  First contact {formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {/* Status selector */}
            <select
              value={lead.status}
              onChange={e => updateLead({ status: e.target.value })}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border-0 cursor-pointer focus:ring-2 focus:ring-omiflow-500 ${currentStatus?.color}`}>
              {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {/* Priority selector */}
            <select
              value={lead.priority}
              onChange={e => updateLead({ priority: e.target.value })}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border-0 cursor-pointer focus:ring-2 focus:ring-omiflow-500 ${currentPriority?.color}`}>
              {priorityOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

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
            <div className="text-xs text-gray-400 mb-1">Total Calls</div>
            <div className="text-sm font-medium text-gray-900">{calls.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Repeat Caller</div>
            <div className="text-sm font-medium text-gray-900">{lead.is_repeat_caller ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Tasks</h2>
              <button onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1 text-xs text-omiflow-600 hover:text-omiflow-700 font-medium">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {showAddTask && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  placeholder="Task title" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-omiflow-500" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={newTask.type} onChange={e => setNewTask(p => ({ ...p, type: e.target.value }))}
                    className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-omiflow-500">
                    <option value="callback">Callback</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="consultation_prep">Consultation Prep</option>
                    <option value="general">General</option>
                  </select>
                  <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-omiflow-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input type="datetime-local" value={newTask.due_at} onChange={e => setNewTask(p => ({ ...p, due_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-omiflow-500" />
                <div className="flex gap-2">
                  <button onClick={addTask} className="flex-1 bg-omiflow-600 text-white text-xs py-1.5 rounded font-medium hover:bg-omiflow-700">Add Task</button>
                  <button onClick={() => setShowAddTask(false)} className="flex-1 border border-gray-200 text-gray-600 text-xs py-1.5 rounded hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="flex items-start gap-2">
                  <button
                    onClick={() => task.status === 'pending' && completeTask(task.id)}
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-omiflow-500'
                    }`}>
                    {task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </div>
                    {task.due_at && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
              )) : <p className="text-xs text-gray-400">No tasks yet</p>}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Notes</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this lead..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500 resize-none" />
            <button onClick={saveNotes} disabled={saving}
              className="mt-2 flex items-center gap-1.5 text-xs bg-omiflow-600 text-white px-3 py-1.5 rounded-lg hover:bg-omiflow-700 disabled:opacity-50 font-medium">
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Appointments */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Appointments</h2>
            {appointments.length > 0 ? (
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
            ) : <p className="text-xs text-gray-400">No appointments yet</p>}
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
              const call = isCall ? item.data : null
              const summary = call?.summaries?.[0]?.content
              const sentiment = call?.sentiment_scores?.[0]?.sentiment
              const quality = call?.lead_scores?.[0]?.quality

              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCall ? 'bg-purple-100' : isSMS ? 'bg-blue-100' : isEmail ? 'bg-green-100' : 'bg-orange-100'
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
                      <span className="text-xs font-semibold text-gray-700">
                        {isCall ? `${call?.handled_by === 'ai' ? '🤖 AI' : '👤 Human'} Call` :
                         isSMS ? '📱 SMS Sent' :
                         isEmail ? '📧 Email Sent' :
                         `📅 ${(item.data as any).title}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                      </span>
                    </div>
                    {summary && <p className="text-xs text-gray-600 mb-1">{summary}</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {sentiment && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment}`}>{sentiment}</span>
                      )}
                      {quality && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium priority-${quality}`}>{quality}</span>
                      )}
                    </div>
                    {isCall && call?.id && (
                      <a href={`/dashboard/calls/${call.id}`} className="text-xs text-omiflow-600 hover:underline mt-1 block">
                        View full call details →
                      </a>
                    )}
                    {isSMS && <p className="text-xs text-gray-600">{(item.data as any).content}</p>}
                    {isAppt && <p className="text-xs text-gray-500">{format(new Date(item.date), 'PPp')}</p>}
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
