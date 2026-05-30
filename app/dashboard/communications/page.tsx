import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Mail, Phone } from 'lucide-react'

const typeIcon: Record<string, any> = {
  sms: MessageSquare,
  email: Mail,
  call: Phone
}

const typeColor: Record<string, string> = {
  sms: 'bg-blue-100 text-blue-600',
  email: 'bg-green-100 text-green-600',
  call: 'bg-purple-100 text-purple-600'
}

export default async function CommunicationsPage({
  searchParams
}: {
  searchParams: { type?: string }
}) {
  const supabase = createServerClientInstance(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  let query = supabase
    .from('communications')
    .select('*, lead:leads(first_name, last_name, phone)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.type) query = query.eq('type', searchParams.type)

  const { data: communications } = await query

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-sm text-gray-500 mt-0.5">All outbound SMS, emails, and call records</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'sms', 'email', 'call'].map(t => (
          <a key={t} href={t === 'all' ? '/dashboard/communications' : `/dashboard/communications?type=${t}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (t === 'all' && !searchParams.type) || searchParams.type === t
                ? 'bg-omiflow-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t === 'all' ? 'All' : t.toUpperCase()}
          </a>
        ))}
      </div>

      {/* Communications list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {communications && communications.length > 0 ? communications.map(comm => {
          const lead = comm.lead as any
          const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : comm.to_address
          const Icon = typeIcon[comm.type] || MessageSquare
          const colorClass = typeColor[comm.type] || 'bg-gray-100 text-gray-600'

          return (
            <div key={comm.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-gray-900 text-sm">{leadName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    comm.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {comm.direction}
                  </span>
                </div>
                {comm.subject && <div className="text-xs font-medium text-gray-700 mb-0.5">{comm.subject}</div>}
                {comm.content && (
                  <div className="text-xs text-gray-500 truncate max-w-xl">{comm.content}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {comm.from_address} → {comm.to_address}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  comm.status === 'sent' || comm.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{comm.status}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          )
        }) : (
          <div className="p-12 text-center text-gray-400">No communications yet</div>
        )}
      </div>
    </div>
  )
}
