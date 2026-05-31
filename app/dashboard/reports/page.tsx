import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

export default async function ReportsPage() {
  const supabase = createServerClientInstance(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = (userData as any)?.organization_id

  // Get stats for last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

  const [callsRes, leadsRes, tasksRes, sentimentRes, practiceAreaRes] = await Promise.all([
    supabase.from('calls').select('id, handled_by, duration_seconds, started_at').eq('organization_id', orgId).gte('started_at', thirtyDaysAgo),
    supabase.from('leads').select('id, status, priority, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('tasks').select('id, status, priority').eq('organization_id', orgId),
    supabase.from('sentiment_scores').select('sentiment').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('call_classifications').select('practice_area_name').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo)
  ])

  const calls = callsRes.data || []
  const leads = leadsRes.data || []
  const tasks = tasksRes.data || []
  const sentiments = sentimentRes.data || []
  const classifications = practiceAreaRes.data || []

  // Calculate metrics
  const totalCalls = calls.length
  const aiHandled = calls.filter(c => c.handled_by === 'ai').length
  const humanHandled = calls.filter(c => c.handled_by === 'human').length
  const aiRate = totalCalls > 0 ? Math.round((aiHandled / totalCalls) * 100) : 0

  const avgDuration = calls.length > 0
    ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
    : 0

  const retainedLeads = leads.filter(l => l.status === 'retained').length
  const totalLeads = leads.length
  const retainRate = totalLeads > 0 ? Math.round((retainedLeads / totalLeads) * 100) : 0

  const pendingTasks = tasks.filter(t => t.status === 'pending').length
  const completedTasks = tasks.filter(t => t.status === 'completed').length

  // Sentiment breakdown
  const sentimentCounts = sentiments.reduce((acc: Record<string, number>, s) => {
    acc[s.sentiment] = (acc[s.sentiment] || 0) + 1
    return acc
  }, {})

  // Practice area breakdown
  const practiceAreaCounts = classifications.reduce((acc: Record<string, number>, c) => {
    if (c.practice_area_name) acc[c.practice_area_name] = (acc[c.practice_area_name] || 0) + 1
    return acc
  }, {})

  const topPracticeAreas = Object.entries(practiceAreaCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Last 30 days performance</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: totalCalls, sub: 'Last 30 days' },
          { label: 'AI Handle Rate', value: `${aiRate}%`, sub: `${aiHandled} of ${totalCalls} calls` },
          { label: 'Avg Call Duration', value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`, sub: 'AI calls only' },
          { label: 'Lead Retention Rate', value: `${retainRate}%`, sub: `${retainedLeads} retained` },
        ].map(metric => (
          <div key={metric.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
            <div className="text-sm font-medium text-gray-700 mt-0.5">{metric.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{metric.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Call Handling Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: '🤖 AI Handled', value: aiHandled, color: 'bg-purple-500' },
              { label: '👤 Human Answered', value: humanHandled, color: 'bg-green-500' },
              { label: '📵 Missed / Other', value: totalCalls - aiHandled - humanHandled, color: 'bg-gray-300' }
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${totalCalls > 0 ? (item.value / totalCalls) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Caller Sentiment (30 days)</h2>
          <div className="space-y-2">
            {Object.entries(sentimentCounts).sort(([, a], [, b]) => b - a).map(([sentiment, count]) => (
              <div key={sentiment} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment}`}>
                  {sentiment}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-omiflow-500 rounded-full"
                      style={{ width: `${sentiments.length > 0 ? (count / sentiments.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {sentiments.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </div>

        {/* Top practice areas */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Top Practice Areas</h2>
          <div className="space-y-3">
            {topPracticeAreas.map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{name}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-omiflow-500 rounded-full"
                    style={{ width: `${topPracticeAreas[0][1] > 0 ? (count / topPracticeAreas[0][1]) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {topPracticeAreas.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </div>

        {/* Task completion */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Task Status</h2>
          <div className="space-y-3">
            {[
              { label: 'Pending', value: pendingTasks, color: 'bg-yellow-400' },
              { label: 'Completed', value: completedTasks, color: 'bg-green-500' },
              { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: 'bg-blue-400' },
              { label: 'Cancelled', value: tasks.filter(t => t.status === 'cancelled').length, color: 'bg-gray-300' }
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
