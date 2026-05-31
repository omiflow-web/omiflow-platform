import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { Phone, PhoneCall, Bot, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment}`}>
      {sentiment}
    </span>
  )
}

function PriorityBadge({ quality }: { quality: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium priority-${quality}`}>
      {quality}
    </span>
  )
}

export default async function CallsPage({
  searchParams
}: {
  searchParams: { q?: string; handled_by?: string; sentiment?: string; practice_area?: string }
}) {
  const supabase = createServerClientInstance(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = (userData as any)?.organization_id

  let query = supabase
    .from('calls')
    .select(`
      *,
      summaries(content),
      sentiment_scores(sentiment),
      lead_scores(quality),
      call_classifications(practice_area_name),
      leads(first_name, last_name)
    `)
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })
    .limit(50)

  if (searchParams.handled_by) query = query.eq('handled_by', searchParams.handled_by)

  const { data: calls } = await query

  const filteredCalls = calls?.filter(call => {
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase()
      const matchPhone = call.caller_number?.toLowerCase().includes(q)
      const matchName = `${(call as any).leads?.first_name || ''} ${(call as any).leads?.last_name || ''}`.toLowerCase().includes(q)
      const matchSummary = (call as any).summaries?.[0]?.content?.toLowerCase().includes(q)
      if (!matchPhone && !matchName && !matchSummary) return false
    }
    if (searchParams.sentiment) {
      if ((call as any).sentiment_scores?.[0]?.sentiment !== searchParams.sentiment) return false
    }
    return true
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every call, transcribed and analysed</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <form className="flex-1 min-w-48">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search calls, numbers, summaries..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
          />
        </form>
        <div className="flex gap-2 flex-wrap">
          {['all', 'ai', 'human', 'missed'].map(type => (
            <a key={type} href={type === 'all' ? '/dashboard/calls' : `/dashboard/calls?handled_by=${type}`}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                (type === 'all' && !searchParams.handled_by) || searchParams.handled_by === type
                  ? 'bg-omiflow-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}>
              {type === 'all' ? 'All' : type === 'ai' ? '🤖 AI' : type === 'human' ? '👤 Human' : '📵 Missed'}
            </a>
          ))}
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Caller</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Handled by</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Practice Area</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Sentiment</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Lead Score</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Duration</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Time</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCalls?.map(call => {
                const lead = (call as any).leads
                const sentiment = (call as any).sentiment_scores?.[0]?.sentiment
                const quality = (call as any).lead_scores?.[0]?.quality
                const practiceArea = (call as any).call_classifications?.[0]?.practice_area_name
                const callerName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : null
                const duration = call.duration_seconds
                  ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                  : '—'

                return (
                  <tr key={call.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{callerName || call.caller_number}</div>
                      {callerName && <div className="text-gray-400 text-xs">{call.caller_number}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {call.handled_by === 'ai' ? (
                          <><Bot className="w-3.5 h-3.5 text-purple-500" /><span className="text-purple-700 text-xs font-medium">AI</span></>
                        ) : call.handled_by === 'human' ? (
                          <><User className="w-3.5 h-3.5 text-green-500" /><span className="text-green-700 text-xs font-medium">Human</span></>
                        ) : (
                          <span className="text-gray-400 text-xs">Missed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{practiceArea || '—'}</td>
                    <td className="px-6 py-4">
                      {sentiment ? <SentimentBadge sentiment={sentiment} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {quality ? <PriorityBadge quality={quality} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{duration}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4">
                      <a href={`/dashboard/calls/${call.id}`} className="text-omiflow-600 hover:underline text-xs font-medium">
                        View →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!filteredCalls || filteredCalls.length === 0) && (
            <div className="p-12 text-center text-gray-400">No calls found</div>
          )}
        </div>
      </div>
    </div>
  )
}
