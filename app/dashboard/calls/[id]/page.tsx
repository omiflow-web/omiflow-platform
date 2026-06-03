import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any

  const { data: call } = await db
    .from('calls')
    .select(`
      *,
      leads(id, first_name, last_name, phone, status, priority),
      summaries(content, key_points, action_items),
      sentiment_scores(sentiment, score, reasoning),
      lead_scores(quality, score, urgency_score, reasoning),
      call_classifications(practice_area_name, confidence),
      transcripts(content),
      recordings(url)
    `)
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!call) notFound()

  const lead = call.leads
  const summary = call.summaries?.[0]
  const sentiment = call.sentiment_scores?.[0]
  const leadScore = call.lead_scores?.[0]
  const classification = call.call_classifications?.[0]
  const transcript = call.transcripts?.[0]
  const recording = call.recordings?.[0]

  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-600',
    concerned: 'bg-yellow-100 text-yellow-700',
    distressed: 'bg-red-100 text-red-700',
    frustrated: 'bg-orange-100 text-orange-700',
    urgent: 'bg-purple-100 text-purple-700',
    confused: 'bg-blue-100 text-blue-700'
  }

  const qualityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-500'
  }

  const callerName = lead
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || call.caller_number
    : call.caller_number || 'Unknown'

  const dur = call.duration_seconds
    ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : 'Unknown'

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/calls" className="text-sm text-gray-500 hover:text-gray-700">← Back to Calls</Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{callerName}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span>{call.caller_number || 'Unknown number'}</span>
              <span>{call.started_at ? format(new Date(call.started_at), 'PPp') : ''}</span>
              <span>{dur}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${call.handled_by === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
              {call.handled_by === 'ai' ? '🤖 AI Handled' : '👤 Human'}
            </span>
            {sentiment?.sentiment && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${sentimentColors[sentiment.sentiment] || 'bg-gray-100 text-gray-500'}`}>
                {sentiment.sentiment}
              </span>
            )}
            {leadScore?.quality && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${qualityColors[leadScore.quality] || 'bg-gray-100 text-gray-500'}`}>
                {leadScore.quality} quality
              </span>
            )}
          </div>
        </div>

        {lead && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link href={`/dashboard/leads/${lead.id}`} className="text-sm text-omiflow-600 hover:underline font-medium">
              View lead profile: {callerName} →
            </Link>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* AI Analysis */}
        <div className="space-y-4">
          {summary && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">AI Summary</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.content}</p>
              {summary.key_points?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Key Points</div>
                  <ul className="space-y-1">
                    {summary.key_points.map((p: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-omiflow-500 mt-0.5">•</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.action_items?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Action Items</div>
                  <ul className="space-y-1">
                    {summary.action_items.map((a: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {(sentiment || leadScore || classification) && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Analysis Scores</h2>
              <div className="space-y-3">
                {classification?.practice_area_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Practice Area</span>
                    <span className="font-medium text-gray-900">{classification.practice_area_name}</span>
                  </div>
                )}
                {sentiment && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sentiment</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColors[sentiment.sentiment] || ''}`}>
                        {sentiment.sentiment}
                      </span>
                    </div>
                    {sentiment.reasoning && (
                      <p className="text-xs text-gray-400 italic">"{sentiment.reasoning}"</p>
                    )}
                  </>
                )}
                {leadScore && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Lead Quality</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qualityColors[leadScore.quality] || ''}`}>
                        {leadScore.quality}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Lead Score</span>
                      <span className="font-medium text-gray-900">{leadScore.score}/100</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Urgency Score</span>
                      <span className="font-medium text-gray-900">{leadScore.urgency_score}/100</span>
                    </div>
                    {leadScore.reasoning && (
                      <p className="text-xs text-gray-400 italic">"{leadScore.reasoning}"</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Recording */}
          {recording?.url && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Recording</h2>
              <audio controls className="w-full" src={recording.url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
        </div>

        {/* Full Transcript */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Full Transcript</h2>
          {transcript?.content ? (
            <div className="space-y-3 text-sm">
              {transcript.content.split('\n').filter(Boolean).map((line: string, i: number) => {
                const isAI = line.startsWith('AI:')
                const isUser = line.startsWith('User:')
                const content = line.replace(/^(AI:|User:)\s*/, '')
                if (!content.trim()) return null
                return (
                  <div key={i} className={`flex gap-2 ${isAI ? '' : 'flex-row-reverse'}`}>
                    <div className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${isAI ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {isAI ? 'AI' : 'You'}
                    </div>
                    <div className={`text-sm text-gray-700 leading-relaxed max-w-[85%] px-3 py-2 rounded-xl ${isAI ? 'bg-gray-50' : 'bg-omiflow-50 text-right'}`}>
                      {content}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No transcript available for this call</p>
          )}
        </div>
      </div>
    </div>
  )
}
