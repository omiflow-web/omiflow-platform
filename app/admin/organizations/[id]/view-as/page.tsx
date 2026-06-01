import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { Phone, Users, Clock, AlertTriangle, Calendar, TrendingUp, PhoneCall, PhoneMissed, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function ViewAsPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) redirect('/dashboard')

  const db = createServiceClient() as any
  const { data: org } = await db.from('organizations').select('*').eq('id', params.id).single()
  if (!org) redirect('/admin')

  const { data: stats } = await db.rpc('get_dashboard_stats', { org_id: params.id })
  const s = (stats as any) || {}

  const { data: urgentLeads } = await db
    .from('leads').select('*, practice_area:practice_areas(name)')
    .eq('organization_id', params.id).eq('priority', 'critical').eq('status', 'new').eq('is_deleted', false)
    .order('created_at', { ascending: true }).limit(5)

  const { data: recentCalls } = await db
    .from('calls').select('*, summaries(content), sentiment_scores(sentiment)')
    .eq('organization_id', params.id).order('started_at', { ascending: false }).limit(5)

  const { data: pendingTasks } = await db
    .from('tasks').select('*').eq('organization_id', params.id).eq('status', 'pending')
    .order('due_at', { ascending: true }).limit(5)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* View As Banner */}
      <div className="bg-omiflow-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-omiflow-300" />
          <span className="text-sm font-medium">Viewing as <strong>{org.name}</strong> — Admin View Only</span>
          <span className="text-xs text-omiflow-400">Changes made here affect the real account</span>
        </div>
        <a href={`/admin/organizations/${params.id}`}
          className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
          Exit View
        </a>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{org.name} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {(s.urgent_leads || 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="font-semibold text-red-800">{s.urgent_leads} urgent lead{s.urgent_leads !== 1 ? 's' : ''} require immediate attention</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Calls Today', value: s.calls_today || 0, icon: Phone, color: 'bg-blue-50 text-blue-600' },
            { title: 'Calls This Week', value: s.calls_this_week || 0, icon: PhoneCall, color: 'bg-indigo-50 text-indigo-600' },
            { title: 'AI Handled', value: s.ai_handled || 0, icon: PhoneMissed, color: 'bg-purple-50 text-purple-600' },
            { title: 'Consultations', value: s.consultations_booked || 0, icon: Calendar, color: 'bg-green-50 text-green-600' },
            { title: 'New Leads Today', value: s.new_leads_today || 0, icon: Users, color: 'bg-orange-50 text-orange-600' },
            { title: 'Pending Follow-ups', value: s.pending_follow_ups || 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
            { title: 'Urgent Leads', value: s.urgent_leads || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
            { title: 'Missed Recovered', value: s.missed_recovered || 0, icon: TrendingUp, color: 'bg-teal-50 text-teal-600' },
          ].map(stat => (
            <div key={stat.title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm font-medium text-gray-700">{stat.title}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Urgent Leads</h2>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {urgentLeads && urgentLeads.length > 0 ? urgentLeads.map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone}
                      </div>
                      <div className="text-xs text-gray-400">{lead.practice_area?.name || 'General'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {lead.first_contact_at ? formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true }) : ''}
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-400 text-sm">No urgent leads</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Pending Tasks</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingTasks && pendingTasks.length > 0 ? pendingTasks.map((task: any) => (
                <div key={task.id} className="flex items-start justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date'}
                    </div>
                  </div>
                  <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium priority-${task.priority}`}>{task.priority}</span>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-400 text-sm">No pending tasks</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
