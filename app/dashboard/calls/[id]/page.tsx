import { createServerClientInstance } from '@/lib/supabase'
import { redirect, notFound } from 'next/navigation'
import { Phone, Clock, Bot, User, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const { data: call } = await supabase
    .from('calls')
    .select(`
      *,
      transcripts(*),
      summaries(*),
      sentiment_scores(*),
      lead_scores(*),
      call_classifications(*),
      follow_up_recommendations(*),
      leads(*)
    `)
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()

  if (!call) notFound()

  const transcript = (call as any).transcripts?.[0]
  const summary = (call as any).summaries?.[0]
  const sentiment = (call as any).sentiment_scores?.[0]
  const leadScore = (call as any).lead_scores?.[0]
  const classification = (call as any).call_classifications?.[0]
  const followUp = (call as any).follow_up_recommendations?.[0]
  const lead = (call as any).leads

  const duration = call.duration_seconds
    ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : 'Unknown'

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Back */}
      <a href="/dashboard/calls" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Calls
      </a>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {call.handled_by === 'ai' ? <Bot className="w-5 h-5 text-purple-500" /> : <User className="w-5 h-5 text-green-500" />}
              <h1 className="text-xl font-bold text-gray-900">
                {lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || call.caller_number : call.caller_number}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{call.caller_number}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{duration}</span>
              <span>{format(new Date(call.started_at), 'PPpp')}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              call.handled_by === 'ai' ? 'bg-purple-100 text-purple-700' :
              call.handled_by === 'human' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {call.handled_by === 'ai' ? '🤖 AI Handled' : call.handled_by === 'human' ? '👤 Human Handled' : 'Missed'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - AI Analysis */}
        <div className="space-y-4">
          {/* AI Scores */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 text-sm">AI Analysis</h2>
            <div className="space-y-3">
              {sentiment && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Sentiment</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium sentiment-${sentiment.sentiment}`}>
                    {sentiment.sentiment}
                  </span>
                </div>
              )}
              {leadScore && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Lead Quality</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium priority-${leadScore.quality}`}>
                      {leadScore.quality}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Lead Score</span>
                    <span className="text-xs font-bold text-gray-900">{leadScore.score}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Urgency</span>
                    <span className="text-xs font-bold text-gray-900">{leadScore.urgency_score}/100</span>
                  </div>
                </>
              )}
              {classification && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Practice Area</span>
                  <span className="text-xs font-medium text-gray-700">{classification.practice_area_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Action */}
          {followUp && (
            <div className="bg-omiflow-50 border border-omiflow-200 rounded-xl p-5">
              <h2 className="font-semibold text-omiflow-900 mb-2 text-sm">Recommended Action</h2>
              <p className="text-sm text-omiflow-800">{followUp.recommendation}</p>
              {followUp.due_by && (
                <p className="text-xs text-omiflow-600 mt-2">
                  Due by {format(new Date(followUp.due_by), 'PPp')}
                </p>
              )}
            </div>
          )}

          {/* Lead link */}
          {lead && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">Lead Profile</h2>
              <a href={`/dashboard/leads/${lead.id}`}
                className="block w-full text-center bg-omiflow-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-omiflow-700 transition-colors">
                View Full Profile →
              </a>
            </div>
          )}

          {/* Recording */}
          {call.recording_url && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">Recording</h2>
              <audio controls className="w-full" src={call.recording_url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
        </div>

        {/* Right column - Summary + Transcript */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          {summary && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">AI Summary</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.content}</p>
              {summary.key_points?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Points</h3>
                  <ul className="space-y-1">
                    {summary.key_points.map((point: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-omiflow-500 flex-shrink-0">•</span>{point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.action_items?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action Items</h3>
                  <ul className="space-y-1">
                    {summary.action_items.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-green-500 flex-shrink-0">→</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 text-sm">Full Transcript</h2>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {transcript.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
