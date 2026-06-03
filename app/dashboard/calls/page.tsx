import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default async function CallsPage() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any

  const { data: calls } = await db
    .from('calls')
    .select(`
      id, caller_number, handled_by, duration_seconds, started_at, call_type,
      leads(first_name, last_name),
      summaries(content),
      sentiment_scores(sentiment),
      lead_scores(quality)
    `)
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })
    .limit(50)

  const sentimentColors: Record<string, string> = {
    positive: 'text-green-600',
    neutral: 'text-gray-500',
    concerned: 'text-yellow-600',
    distressed: 'text-red-600',
    frustrated: 'text-orange-600',
    urgent: 'text-purple-600',
    confused: 'text-blue-600'
  }

  const qualityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-500'
  }

  const callTypeColors: Record<string, string> = {
    enquiry: 'bg-omiflow-100 text-omiflow-700',
    complaint: 'bg-red-100 text-red-700',
    existing_client: 'bg-blue-100 text-blue-700',
    wrong_number: 'bg-gray-100 text-gray-500',
    supplier: 'bg-gray-100 text-gray-500',
    other: 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every call, transcribed and analysed</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Caller</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Handled by</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Sentiment</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Lead Score</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Duration</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Time</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(calls || []).map((call: any) => {
                const lead = call.leads
                const callerName = lead
                  ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                  : call.caller_number || 'unknown'
                const sentiment = call.sentiment_scores?.[0]?.sentiment
                const quality = call.lead_scores?.[0]?.quality
                const dur = call.duration_seconds
                  ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                  : '—'

                return (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{callerName}</div>
                      {lead && call.caller_number && call.caller_number !== 'unknown' && (
                        <div className="text-xs text-gray-400 font-mono">{call.caller_number}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {call.call_type ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${callTypeColors[call.call_type] || 'bg-gray-100 text-gray-500'}`}>
                          {call.call_type.replace('_', ' ')}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${call.handled_by === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {call.handled_by === 'ai' ? '🤖 AI' : '👤 Human'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sentiment ? (
                        <span className={`text-xs font-medium flex items-center gap-1 ${sentimentColors[sentiment] || 'text-gray-500'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                          {sentiment}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {quality ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qualityColors[quality] || 'bg-gray-100 text-gray-500'}`}>
                          {quality}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{dur}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {call.started_at ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/calls/${call.id}`} className="text-omiflow-600 hover:underline text-xs font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!calls || calls.length === 0) && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No calls yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
