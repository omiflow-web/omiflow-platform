'use client'

import { useState, useEffect } from 'react'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import { createClient } from '@/lib/supabase'
import { TrendingUp, Phone, Users, Calendar, Clock, Target } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function BarChart({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-3">{label}</div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-omiflow-500 rounded-t-sm transition-all hover:bg-omiflow-600 cursor-pointer"
              style={{ height: `${(d.value / max) * 88}px`, minHeight: d.value > 0 ? '4px' : '0' }}>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                {d.value} · {d.date}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  )
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return <div className="text-sm text-gray-400 text-center py-4">No data yet</div>

  let cumulative = 0
  const radius = 60
  const cx = 70
  const cy = 70
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {segments.map((seg, i) => {
          if (seg.value === 0) return null
          const pct = seg.value / total
          const offset = circumference * (1 - cumulative)
          cumulative += pct
          return (
            <circle key={i}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${pct * circumference} ${circumference}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-bold" fill="#111827" fontSize="20" fontWeight="700">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize="11">total</text>
      </svg>
      <div className="space-y-2 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-gray-600">{seg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-900">{seg.value}</span>
              <span className="text-xs text-gray-400">{total > 0 ? Math.round((seg.value / total) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [range, setRange] = useState(30)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const orgId = (userData as any)?.organization_id
      if (!orgId) return

      const since = subDays(new Date(), range).toISOString()
      const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() })

      const [callsRes, leadsRes, tasksRes, sentimentRes, practiceRes, apptRes] = await Promise.all([
        supabase.from('calls').select('id, handled_by, duration_seconds, started_at').eq('organization_id', orgId).gte('started_at', since),
        supabase.from('leads').select('id, status, priority, created_at').eq('organization_id', orgId).gte('created_at', since),
        supabase.from('tasks').select('id, status').eq('organization_id', orgId),
        supabase.from('sentiment_scores').select('sentiment').eq('organization_id', orgId).gte('created_at', since),
        supabase.from('call_classifications').select('practice_area_name').eq('organization_id', orgId).gte('created_at', since),
        supabase.from('appointments').select('id, status, type').eq('organization_id', orgId).gte('starts_at', since),
      ])

      const calls: any[] = callsRes.data || []
      const leads: any[] = leadsRes.data || []
      const tasks: any[] = tasksRes.data || []
      const sentiments: any[] = sentimentRes.data || []
      const classifications: any[] = practiceRes.data || []
      const appointments: any[] = apptRes.data || []

      // Daily call volume for chart
      const callsByDay = days.map(day => {
        const dayStr = format(day, 'MMM d')
        const count = calls.filter(c => format(new Date(c.started_at), 'MMM d') === dayStr).length
        return { date: dayStr, value: count }
      })

      // Daily leads for chart
      const leadsByDay = days.map(day => {
        const dayStr = format(day, 'MMM d')
        const count = leads.filter(l => format(new Date(l.created_at), 'MMM d') === dayStr).length
        return { date: dayStr, value: count }
      })

      // Metrics
      const aiHandled = calls.filter(c => c.handled_by === 'ai').length
      const humanHandled = calls.filter(c => c.handled_by === 'human').length
      const avgDuration = calls.length > 0
        ? Math.round(calls.reduce((s, c) => s + (Number(c.duration_seconds) || 0), 0) / calls.length)
        : 0
      const retainedLeads = leads.filter(l => l.status === 'retained').length
      const consultations = appointments.filter(a => a.type === 'consultation').length
      const completedTasks = tasks.filter(t => t.status === 'completed').length
      const pendingTasks = tasks.filter(t => t.status === 'pending').length

      // Practice area breakdown
      const practiceAreaCounts: Record<string, number> = {}
      classifications.forEach((c: any) => {
        if (c.practice_area_name) practiceAreaCounts[c.practice_area_name] = (practiceAreaCounts[c.practice_area_name] || 0) + 1
      })
      const topAreas = Object.entries(practiceAreaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

      // Sentiment breakdown
      const sentimentCounts: Record<string, number> = {}
      sentiments.forEach((s: any) => {
        sentimentCounts[s.sentiment] = (sentimentCounts[s.sentiment] || 0) + 1
      })

      // Lead status breakdown
      const statusCounts: Record<string, number> = {}
      leads.forEach((l: any) => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
      })

      setData({
        calls, leads, tasks, sentiments, classifications, appointments,
        callsByDay, leadsByDay,
        aiHandled, humanHandled, avgDuration,
        retainedLeads, consultations, completedTasks, pendingTasks,
        topAreas, sentimentCounts, statusCounts,
        totalCalls: calls.length,
        totalLeads: leads.length,
        retainRate: leads.length > 0 ? Math.round((retainedLeads / leads.length) * 100) : 0,
        aiRate: calls.length > 0 ? Math.round((aiHandled / calls.length) * 100) : 0
      })
      setLoading(false)
    }
    load()
  }, [range])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading reports...</div>
  if (!data) return null

  const sentimentColors: Record<string, string> = {
    positive: '#22c55e', neutral: '#94a3b8', concerned: '#f59e0b',
    distressed: '#ef4444', frustrated: '#f97316', urgent: '#dc2626', confused: '#8b5cf6'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance overview for your firm</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => { setRange(d); setLoading(true) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === d ? 'bg-omiflow-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {d === 7 ? '7 days' : d === 30 ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={data.totalCalls} sub={`${data.aiRate}% handled by AI`} icon={Phone} color="bg-blue-50 text-blue-600" />
        <StatCard label="New Leads" value={data.totalLeads} sub={`${data.retainedLeads} retained`} icon={Users} color="bg-purple-50 text-purple-600" />
        <StatCard label="Consultations" value={data.consultations} icon={Calendar} color="bg-green-50 text-green-600" />
        <StatCard label="Avg Call Duration" value={`${Math.floor(data.avgDuration / 60)}m ${data.avgDuration % 60}s`} icon={Clock} color="bg-orange-50 text-orange-600" />
        <StatCard label="AI Handle Rate" value={`${data.aiRate}%`} sub={`${data.aiHandled} AI · ${data.humanHandled} human`} icon={TrendingUp} color="bg-omiflow-50 text-omiflow-600" />
        <StatCard label="Retention Rate" value={`${data.retainRate}%`} sub={`${data.retainedLeads} clients retained`} icon={Target} color="bg-teal-50 text-teal-600" />
        <StatCard label="Tasks Completed" value={data.completedTasks} sub={`${data.pendingTasks} still pending`} icon={TrendingUp} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Recovered Calls" value={data.aiHandled} sub="Calls AI answered" icon={Phone} color="bg-indigo-50 text-indigo-600" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Call Volume — Last {range} Days</h2>
          <BarChart data={data.callsByDay} label="" />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">New Leads — Last {range} Days</h2>
          <BarChart data={data.leadsByDay} label="" />
        </div>
      </div>

      {/* Breakdowns row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Call handling */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Call Handling</h2>
          <DonutChart segments={[
            { label: 'AI Handled', value: data.aiHandled, color: '#6172f3' },
            { label: 'Human Answered', value: data.humanHandled, color: '#22c55e' },
            { label: 'Other', value: data.totalCalls - data.aiHandled - data.humanHandled, color: '#e5e7eb' },
          ]} />
        </div>

        {/* Sentiment */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Caller Sentiment</h2>
          <DonutChart segments={
            Object.entries(data.sentimentCounts).map(([s, count]) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              value: count as number,
              color: sentimentColors[s] || '#94a3b8'
            }))
          } />
          {Object.keys(data.sentimentCounts).length === 0 && (
            <p className="text-sm text-gray-400 text-center">No calls yet</p>
          )}
        </div>

        {/* Lead status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Lead Pipeline</h2>
          <div className="space-y-2">
            {[
              { key: 'new', label: 'New', color: '#6172f3' },
              { key: 'contacted', label: 'Contacted', color: '#8b5cf6' },
              { key: 'consultation_scheduled', label: 'Consultation Booked', color: '#f59e0b' },
              { key: 'retained', label: 'Retained', color: '#22c55e' },
              { key: 'lost', label: 'Lost', color: '#e5e7eb' },
            ].map(item => {
              const count = data.statusCounts[item.key] || 0
              const total = data.totalLeads || 1
              return (
                <div key={item.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / total) * 100}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Practice areas */}
      {data.topAreas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Top Practice Areas</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.topAreas.map(([name, count]: [string, number]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-700 font-medium">{name}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-omiflow-500 rounded-full"
                    style={{ width: `${(count / (data.topAreas[0]?.[1] || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
