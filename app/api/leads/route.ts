import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function PATCH(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { leadId, ...updates } = body

  const db = createServiceClient() as any

  // Verify lead belongs to this org
  const { data: lead } = await db.from('leads').select('id, status').eq('id', leadId).eq('organization_id', orgId).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Log status change if status is changing
  if (updates.status && updates.status !== lead.status) {
    await db.from('lead_statuses').insert({
      organization_id: orgId,
      lead_id: leadId,
      status: updates.status,
      changed_by: user.id
    })
  }

  const { data: updated } = await db.from('leads').update({
    ...updates,
    updated_at: new Date().toISOString()
  }).eq('id', leadId).select().single()

  return NextResponse.json({ lead: updated })
}
