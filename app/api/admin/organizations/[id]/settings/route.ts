import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { type, data } = body
  const db = createServiceClient() as any

  if (type === 'ai_config') {
    await db.from('organization_ai_configs').update({ ...data, updated_at: new Date().toISOString() }).eq('organization_id', params.id)
  }
  if (type === 'settings') {
    await db.from('organization_settings').update({ ...data, updated_at: new Date().toISOString() }).eq('organization_id', params.id)
  }

  return NextResponse.json({ success: true })
}
