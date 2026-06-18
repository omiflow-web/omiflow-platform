import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import OpportunityClient from './opportunity-client'

export default async function OpportunityDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any

  const { data: opp } = await db
    .from('opportunities')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single()

  if (!opp) notFound()

  // Team members for the owner dropdown
  const { data: team } = await db
    .from('users')
    .select('id, first_name, last_name')
    .eq('organization_id', orgId)

  // Status history timeline
  const { data: history } = await db
    .from('opportunity_status_history')
    .select('status, created_at')
    .eq('opportunity_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Linked calls + tasks if those tables exist
  const { data: calls } = await db
    .from('calls')
    .select('id, started_at, duration_seconds, handled_by')
    .eq('opportunity_id', params.id)
    .order('started_at', { ascending: false })
    .then((r: any) => r, () => ({ data: [] }))

  return (
    <OpportunityClient
      opp={opp}
      team={team || []}
      history={history || []}
      calls={calls || []}
    />
  )
}
