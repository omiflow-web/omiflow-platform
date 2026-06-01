import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const orgId = searchParams.get('state')
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

  if (!code || !orgId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/calendar?error=missing_params`)
  }

  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${APP_URL}/api/calendar/callback/microsoft`,
        grant_type: 'authorization_code',
        scope: 'Calendars.ReadWrite offline_access'
      })
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) throw new Error('No access token')

    // Get default calendar
    const calRes = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    const cal = await calRes.json()

    const db = createServiceClient() as any
    await db.from('calendar_integrations').upsert({
      organization_id: orgId,
      provider: 'microsoft',
      is_active: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      calendar_id: cal.id || 'primary',
      calendar_name: cal.name || 'Outlook Calendar'
    }, { onConflict: 'organization_id,provider' })

    return NextResponse.redirect(`${APP_URL}/dashboard/calendar?connected=microsoft`)
  } catch (error) {
    console.error('Microsoft OAuth error:', error)
    return NextResponse.redirect(`${APP_URL}/dashboard/calendar?error=microsoft_failed`)
  }
}
