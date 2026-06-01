import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function PATCH(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role_name').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { leadId, ...updates } = body
  const db = createServiceClient() as any

  const { data: lead } = await db.from('leads').select('id, status, organization_id').eq('id', leadId).eq('organization_id', orgId).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  if (updates.status && updates.status !== lead.status) {
    await db.from('lead_statuses').insert({
      organization_id: orgId,
      lead_id: leadId,
      status: updates.status,
      changed_by: user.id
    })
  }

  if (updates.is_deleted) {
    updates.deleted_by = user.id
  }

  const { data: updated } = await db.from('leads').update({
    ...updates,
    updated_at: new Date().toISOString()
  }).eq('id', leadId).select().single()

  return NextResponse.json({ lead: updated })
}

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role_name').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  const roleName = (userData as any)?.role_name

  // Only owners can permanently delete
  if (roleName !== 'owner') return NextResponse.json({ error: 'Only account owners can permanently delete leads' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'No lead ID' }, { status: 400 })

  const db = createServiceClient() as any
  await db.from('leads').delete().eq('id', leadId).eq('organization_id', orgId)

  return NextResponse.json({ success: true })
}
