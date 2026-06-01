import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || ''
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const { data: integrations } = await db
    .from('calendar_integrations')
    .select('*')
    .eq('organization_id', orgId)

  return NextResponse.json({ integrations: integrations || [] })
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
  const { action, provider } = body

  if (action === 'connect') {
    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: `${APP_URL}/api/calendar/callback/google`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
        access_type: 'offline',
        prompt: 'consent',
        state: orgId
      })
      return NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
    }

    if (provider === 'microsoft') {
      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        redirect_uri: `${APP_URL}/api/calendar/callback/microsoft`,
        response_type: 'code',
        scope: 'Calendars.ReadWrite offline_access',
        state: orgId
      })
      return NextResponse.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` })
    }
  }

  if (action === 'disconnect') {
    const db = createServiceClient() as any
    await db.from('calendar_integrations')
      .update({ is_active: false, access_token: null, refresh_token: null })
      .eq('organization_id', orgId)
      .eq('provider', provider)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
