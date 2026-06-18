import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import ReportsClient from './reports-client'

export default async function ReportsPage() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const db = createServiceClient() as any
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 30-day window for recovery report
  const { data: recent } = await db
    .from('opportunities')
    .select('id, status, outcome, is_stalled, next_action_date, follow_up_count, created_at')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .gte('created_at', thirtyDaysAgo)

  // All-time for conversion + opportunity reports
  const { data: all } = await db
    .from('opportunities')
    .select('id, status, outcome, priority, source, reason_lost, created_at')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)

  return <ReportsClient recent={recent || []} all={all || []} />
}
