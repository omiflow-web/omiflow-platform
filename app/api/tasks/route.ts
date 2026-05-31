import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const db = createServiceClient() as any

  const { data: task } = await db.from('tasks').insert({
    organization_id: orgId,
    created_by: user.id,
    ...body
  }).select().single()

  return NextResponse.json({ task })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { taskId, ...updates } = body
  const db = createServiceClient() as any

  if (updates.status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { data: task } = await db.from('tasks').update({
    ...updates,
    updated_at: new Date().toISOString()
  }).eq('id', taskId).eq('organization_id', orgId).select().single()

  return NextResponse.json({ task })
}
