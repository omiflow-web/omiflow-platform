import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import LeadsClient from './leads-client'

export default async function LeadsPage({
  searchParams
}: {
  searchParams: { status?: string; q?: string; filter?: string; deleted?: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, role_name')
    .eq('id', user.id)
    .single()

  const orgId = (userData as any)?.organization_id
  if (!orgId) redirect('/auth/login')

  const showDeleted = searchParams.deleted === 'true'
  const roleName = (userData as any)?.role_name || 'receptionist'
  const isOwner = roleName === 'owner'

  let query = supabase
    .from('leads')
    .select('*, practice_area:practice_areas(name, color), assigned_staff:staff_members(first_name, last_name)')
    .eq('organization_id', orgId)
    .eq('is_deleted', showDeleted)
    .order('created_at', { ascending: false })

  if (searchParams.status) query = (query as any).eq('status', searchParams.status)
  if (searchParams.filter === 'urgent') query = (query as any).eq('priority', 'critical')

  const { data: leads } = await query

  const filteredLeads = (leads || []).filter((lead: any) => {
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase()
      const name = `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase()
      return name.includes(q) || lead.phone?.includes(q) || lead.email?.toLowerCase().includes(q)
    }
    return true
  })

  const counts = (leads || []).reduce((acc: Record<string, number>, lead: any) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {})

  return (
    <LeadsClient
      initialLeads={filteredLeads}
      counts={counts}
      searchParams={searchParams}
      isOwner={isOwner}
      showDeleted={showDeleted}
    />
  )
}
