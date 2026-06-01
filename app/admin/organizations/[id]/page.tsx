import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import AdminOrgClient from './admin-org-client'

export default async function AdminOrgPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) redirect('/dashboard')

  const db = createServiceClient() as any

  const { data: org } = await db.from('organizations').select('*').eq('id', params.id).single()
  if (!org) notFound()

  const [billing, staff, phones, aiConfig, settings, practiceAreas, documents, calls, leads] = await Promise.all([
    db.from('billing_subscriptions').select('*').eq('organization_id', params.id).single(),
    db.from('staff_members').select('*').eq('organization_id', params.id).order('created_at', { ascending: true }),
    db.from('phone_numbers').select('*').eq('organization_id', params.id),
    db.from('organization_ai_configs').select('*').eq('organization_id', params.id).single(),
    db.from('organization_settings').select('*').eq('organization_id', params.id).single(),
    db.from('practice_areas').select('*').eq('organization_id', params.id).eq('is_active', true),
    db.from('knowledge_documents').select('*').eq('organization_id', params.id).order('created_at', { ascending: false }),
    db.from('calls').select('id', { count: 'exact', head: true }).eq('organization_id', params.id),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', params.id).eq('is_deleted', false),
  ])

  return (
    <AdminOrgClient
      org={org}
      billing={billing.data}
      staff={staff.data || []}
      phones={phones.data || []}
      aiConfig={aiConfig.data}
      settings={settings.data}
      practiceAreas={practiceAreas.data || []}
      documents={documents.data || []}
      callCount={calls.count || 0}
      leadCount={leads.count || 0}
    />
  )
}
