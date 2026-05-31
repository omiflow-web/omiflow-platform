import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const { data: staff } = await db.from('staff_members').select('*').eq('organization_id', orgId).order('created_at', { ascending: true })

  return NextResponse.json({ staff })
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { firstName, lastName, email, phone, role } = body

  const db = createServiceClient() as any

  // Create Supabase auth user with temp password
  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
  const { data: authUser, error: authError } = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true
  })

  if (authError) {
    // User might already exist — create staff member without auth user
    const { data: staff } = await db.from('staff_members').insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      is_active: true,
      receives_notifications: true
    }).select().single()

    return NextResponse.json({ staff, tempPassword: null, note: 'Staff member created without portal access' })
  }

  // Create user record
  const { data: roleRow } = await db.from('roles').select('id').eq('name', role || 'receptionist').single()

  await db.from('users').insert({
    id: authUser.user.id,
    organization_id: orgId,
    role_id: roleRow?.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone
  })

  const { data: staff } = await db.from('staff_members').insert({
    organization_id: orgId,
    user_id: authUser.user.id,
    role_id: roleRow?.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    is_active: true,
    receives_notifications: true
  }).select().single()

  return NextResponse.json({ staff, tempPassword })
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
  const { staffId, ...updates } = body
  const db = createServiceClient() as any

  const { data: staff } = await db.from('staff_members').update({
    ...updates,
    updated_at: new Date().toISOString()
  }).eq('id', staffId).eq('organization_id', orgId).select().single()

  return NextResponse.json({ staff })
}
