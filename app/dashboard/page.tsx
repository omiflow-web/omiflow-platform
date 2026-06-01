import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id, first_name, role_name').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()

  const [callsToday, callsWeek, newLeadsToday, urgentLeads, pendingTasks, recentCalls, consultations] = await Promise.all([
    db.from('calls').select('id, handled_by', { count: 'exact' }).eq('organization_id', orgId).gte('started_at', todayStart),
    db.from('calls').select('id', { count: 'exact' }).eq('organization_id', orgId).gte('started_at', weekStart),
    db.from('leads').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('is_deleted', false).gte('created_at', todayStart),
    db.from('leads').select('id, first_name, last_name, phone, priority, first_contact_at, practice_area:practice_areas(name)').eq('organization_id', orgId).eq('priority', 'critical').eq('status', 'new').eq('is_deleted', false).order('created_at', { ascending: true }).limit(5),
    db.from('tasks').select('id, title, priority, due_at, status, lead_id').eq('organization_id', orgId).eq('status', 'pending').order('due_at', { ascending: true }).limit(5),
    db.from('calls').select('id, caller_number, handled_by, duration_seconds, started_at, call_type, summaries(content), sentiment_scores(sentiment), lead_scores(quality), leads(first_name, last_name)').eq('organization_id', orgId).order('started_at', { ascending: false }).limit(6),
    db.from('appointments').select('id', { count: 'exact' }).eq('organization_id', orgId).gte('starts_at', weekStart),
  ])

  const todayCalls = callsToday.data || []
  const aiHandled = todayCalls.filter((c: any) => c.handled_by === 'ai').length
  const urgent = (urgentLeads.data || [])
  const tasks = (pendingTasks.data || [])
  const calls = (recentCalls.data || [])

  const firstName = (userData as any)?.first_name || 'there'

  return (
    <div className="space-y-4 px-4 pt-4 md:px-6 md:pt-6 md:space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 md:text-2xl">Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5 md:text-sm">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Urgent alert */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 md:p-4 md:gap-3">
          <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-xs font-semibold text-red-800 md:text-sm">
            {urgent.length} urgent lead{urgent.length !== 1 ? 's' : ''} need immediate attention
          </span>
        </div>
      )}

      {/* Stats grid — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { label: 'Calls Today', value: callsToday.count || 0, sub: `${aiHandled} handled by AI`, color: 'bg-blue-50', iconColor: '#3b82f6',
            icon: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.47 2 2 0 013.6 1.27h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.91 8.91a16 16 0 006.18 6.18l.95-.96a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/> },
          { label: 'New Leads', value: newLeadsToday.count || 0, sub: `${urgent.length} critical`, color: 'bg-purple-50', iconColor: '#8b5cf6',
            icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></> },
          { label: 'Consultations', value: consultations.count || 0, sub: 'This week', color: 'bg-green-50', iconColor: '#16a34a',
            icon: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></> },
          { label: 'Pending Tasks', value: tasks.length, sub: `${tasks.filter((t: any) => t.due_at && new Date(t.due_at) < new Date()).length} overdue`, color: 'bg-orange-50', iconColor: '#ea580c',
            icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-3 md:p-5">
            <div className={`w-7 h-7 ${stat.color} rounded-lg flex items-center justify-center mb-2 md:w-9 md:h-9 md:mb-3`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stat.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {stat.icon}
              </svg>
            </div>
            <div className="text-xl font-bold text-gray-900 leading-none md:text-2xl">{stat.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{stat.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 md:text-xs">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* 2 col on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">

        {/* Urgent Leads */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Urgent Leads
            </div>
            <a href="/dashboard/leads" className="text-[10px] text-omiflow-600 font-medium">View all</a>
          </div>
          <div className="divide-y divide-gray-50">
            {urgent.length > 0 ? urgent.map((lead: any) => {
              const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
              const isVeryUrgent = lead.priority === 'critical'
              return (
                <div key={lead.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isVeryUrgent ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`} />
                    <div>
                      <div className="text-xs font-medium text-gray-900">{name}</div>
                      <div className="text-[10px] text-gray-400">{lead.practice_area?.name || 'General'}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">Critical</span>
                    <span className="text-[10px] text-gray-400">
                      {lead.first_contact_at ? formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </div>
              )
            }) : (
              <div className="px-4 py-8 text-center text-xs text-gray-400">No urgent leads</div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              Tasks
            </div>
            <a href="/dashboard/tasks" className="text-[10px] text-omiflow-600 font-medium">View all</a>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.length > 0 ? tasks.slice(0, 5).map((task: any) => {
              const isOverdue = task.due_at && new Date(task.due_at) < new Date()
              const priorityColors: Record<string, string> = {
                urgent: 'bg-red-100 text-red-700',
                high: 'bg-orange-100 text-orange-700',
                medium: 'bg-blue-100 text-blue-700',
                low: 'bg-gray-100 text-gray-500'
              }
              return (
                <div key={task.id} className="flex items-start gap-2.5 px-4 py-3">
                  <div className="w-3.5 h-3.5 border-[1.5px] border-gray-300 rounded mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 leading-tight truncate">{task.title}</div>
                    <div className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {isOverdue ? `⚠️ Overdue` : task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date'}
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${priorityColors[task.priority] || 'bg-gray-100 text-gray-500'}`}>
                    {task.priority}
                  </span>
                </div>
              )
            }) : (
              <div className="px-4 py-8 text-center text-xs text-gray-400">No pending tasks</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Calls — card list style on mobile */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.47 2 2 0 013.6 1.27h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.91 8.91a16 16 0 006.18 6.18l.95-.96a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
            Recent Calls
          </div>
          <a href="/dashboard/calls" className="text-[10px] text-omiflow-600 font-medium">View all</a>
        </div>
        <div className="divide-y divide-gray-50">
          {calls.length > 0 ? calls.map((call: any) => {
            const lead = call.leads
            const name = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : call.caller_number
            const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() : '?'
            const sentiment = call.sentiment_scores?.[0]?.sentiment
            const quality = call.lead_scores?.[0]?.quality
            const isAI = call.handled_by === 'ai'
            const dur = call.duration_seconds ? `${Math.floor(call.duration_seconds/60)}m ${call.duration_seconds%60}s` : '—'

            const avatarColors: Record<string, string> = {
              A: 'bg-purple-100 text-purple-700', B: 'bg-blue-100 text-blue-700',
              C: 'bg-green-100 text-green-700', D: 'bg-orange-100 text-orange-700',
              E: 'bg-pink-100 text-pink-700', default: 'bg-gray-100 text-gray-600'
            }
            const avatarColor = avatarColors[initials[0]] || avatarColors.default

            const sentimentColors: Record<string, string> = {
              positive: 'text-green-600', distressed: 'text-red-600',
              concerned: 'text-yellow-600', frustrated: 'text-orange-600',
              urgent: 'text-purple-600', neutral: 'text-gray-400'
            }

            const sentimentDots: Record<string, string> = {
              positive: 'bg-green-500', distressed: 'bg-red-500',
              concerned: 'bg-yellow-500', frustrated: 'bg-orange-500',
              urgent: 'bg-purple-500', neutral: 'bg-gray-400'
            }

            return (
              <a key={call.id} href={`/dashboard/calls/${call.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor}`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{name}</div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">
                    {call.call_type && call.call_type !== 'enquiry' ? call.call_type.replace('_', ' ') : 'Enquiry'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isAI ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {isAI ? 'AI' : 'Human'}
                  </span>
                  {sentiment && (
                    <div className={`flex items-center gap-1 text-[10px] ${sentimentColors[sentiment] || 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sentimentDots[sentiment] || 'bg-gray-400'}`} />
                      {sentiment}
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400 font-mono">{dur}</span>
                </div>
              </a>
            )
          }) : (
            <div className="px-4 py-8 text-center text-xs text-gray-400">No calls yet</div>
          )}
        </div>
      </div>

    </div>
  )
}
