import { createServerClientInstance } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Phone, Users, Clock, AlertTriangle, Calendar, TrendingUp, PhoneCall, PhoneMissed } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Lead, DashboardStats } from '@/types/database'

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  )
}

function UrgentLeadRow({ lead }: { lead: Lead }) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone
  const waitTime = lead.first_contact_at
    ? formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true })
    : 'Unknown'

  return (
    <a href={`/dashboard/leads/${lead.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <div>
          <div className="font-medium text-gray-900 text-sm group-hover:text-omiflow-600">{name}</div>
          <div className="text-xs text-gray-400">{(lead as any).practice_area?.name || 'General Enquiry'}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs font-medium text-red-600">Not contacted</div>
        <div className="text-xs text-gray-400">{waitTime}</div>
      </div>
    </a>
  )
}

export default async function DashboardPage() {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  // Get dashboard stats
  const { data: stats } = await supabase
    .rpc('get_dashboard_stats', { org_id: orgId })

  const s = (stats as DashboardStats) || {}

  // Get urgent leads
  const { data: urgentLeads } = await supabase
    .from('leads')
    .select('*, practice_area:practice_areas(name)')
    .eq('organization_id', orgId)
    .eq('priority', 'critical')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(5)

  // Get recent calls
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('*, summaries(content), sentiment_scores(sentiment)')
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })
    .limit(5)

  // Get pending tasks
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('*, lead:leads(first_name, last_name, phone)')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .order('due_at', { ascending: true })
    .limit(5)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Urgent Alert */}
      {(s.urgent_leads || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-red-800">{s.urgent_leads} urgent lead{s.urgent_leads !== 1 ? 's' : ''} require immediate attention</span>
            <span className="text-red-600 text-sm ml-2">These callers have been waiting too long.</span>
          </div>
          <a href="/dashboard/leads?filter=urgent" className="ml-auto text-sm font-medium text-red-700 hover:text-red-900 whitespace-nowrap">
            View all →
          </a>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Calls Today" value={s.calls_today || 0} subtitle="vs yesterday" icon={Phone} color="bg-blue-50 text-blue-600" />
        <StatCard title="Calls This Week" value={s.calls_this_week || 0} icon={PhoneCall} color="bg-indigo-50 text-indigo-600" />
        <StatCard title="AI Handled" value={s.ai_handled || 0} subtitle="This week" icon={PhoneMissed} color="bg-purple-50 text-purple-600" />
        <StatCard title="Consultations" value={s.consultations_booked || 0} subtitle="This month" icon={Calendar} color="bg-green-50 text-green-600" />
        <StatCard title="New Leads Today" value={s.new_leads_today || 0} icon={Users} color="bg-orange-50 text-orange-600" />
        <StatCard title="Pending Follow-ups" value={s.pending_follow_ups || 0} icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard title="Urgent Leads" value={s.urgent_leads || 0} icon={AlertTriangle} color="bg-red-50 text-red-600" />
        <StatCard title="Missed Recovered" value={s.missed_recovered || 0} subtitle="This month" icon={TrendingUp} color="bg-teal-50 text-teal-600" />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Urgent Leads */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Urgent Leads</h2>
            </div>
            <a href="/dashboard/leads?filter=urgent" className="text-xs text-omiflow-600 hover:underline">View all</a>
          </div>
          <div className="divide-y divide-gray-50">
            {urgentLeads && urgentLeads.length > 0 ? (
              urgentLeads.map(lead => <UrgentLeadRow key={lead.id} lead={lead as any} />)
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                No urgent leads — great work! 🎉
              </div>
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Pending Tasks</h2>
            </div>
            <a href="/dashboard/tasks" className="text-xs text-omiflow-600 hover:underline">View all</a>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingTasks && pendingTasks.length > 0 ? (
              pendingTasks.map(task => (
                <div key={task.id} className="flex items-start justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {task.due_at ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true }) : 'No due date'}
                    </div>
                  </div>
                  <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium priority-${task.priority}`}>
                    {task.priority}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                No pending tasks
              </div>
            )}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-omiflow-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Recent Calls</h2>
            </div>
            <a href="/dashboard/calls" className="text-xs text-omiflow-600 hover:underline">View all</a>
          </div>
          <div className="divide-y divide-gray-50">
            {recentCalls && recentCalls.length > 0 ? (
              recentCalls.map(call => {
                const summary = (call as any).summaries?.[0]?.content
                const sentiment = (call as any).sentiment_scores?.[0]?.sentiment
                const duration = call.duration_seconds
                  ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                  : '—'

                return (
                  <a key={call.id} href={`/dashboard/calls/${call.id}`}
                    className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${call.handled_by === 'ai' ? 'bg-purple-400' : call.handled_by === 'human' ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900">{call.caller_number}</span>
                        {sentiment && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment}`}>
                            {sentiment}
                          </span>
                        )}
                      </div>
                      {summary && <div className="text-xs text-gray-500 truncate">{summary}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-400">{duration}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                      </div>
                    </div>
                  </a>
                )
              })
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">No calls yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
