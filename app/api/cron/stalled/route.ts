import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Stalled detection — runs on a schedule (Vercel cron) or can be hit manually.
// An enquiry is "stalled" when it is still active but has gone quiet, per the rules below.
// We do not estimate revenue or loss. We only identify inactivity.

export async function GET(request: NextRequest) {
  // Optional auth: if CRON_SECRET is set, require it
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      // allow manual browser hits only if no secret enforcement needed
      const url = new URL(request.url)
      if (url.searchParams.get('key') !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  const db = createServiceClient() as any
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Pull all still-active enquiries across all orgs
  const { data: active } = await db
    .from('opportunities')
    .select('id, organization_id, status, last_activity_at, next_action_date, created_at, first_name, last_name, company_name')
    .eq('outcome', 'still_active')
    .eq('is_deleted', false)

  let flagged = 0
  let cleared = 0

  for (const o of active || []) {
    let stalled = false
    let reason = ''

    const lastActivity = o.last_activity_at ? new Date(o.last_activity_at) : new Date(o.created_at)
    const hasNextAction = !!o.next_action_date

    // Rule 1: new enquiry, never contacted, sitting over 7 days
    if (o.status === 'new_enquiry' && lastActivity.toISOString() < sevenDaysAgo) {
      stalled = true
      reason = 'New enquiry not contacted for 7+ days'
    }
    // Rule 2: consultation completed but no follow-up activity in 7 days
    else if (o.status === 'consultation_completed' && lastActivity.toISOString() < sevenDaysAgo) {
      stalled = true
      reason = 'Consultation completed but no follow-up'
    }
    // Rule 3: no activity at all for 14+ days
    else if (lastActivity.toISOString() < fourteenDaysAgo) {
      stalled = true
      reason = 'No activity for 14+ days'
    }
    // Rule 4: no activity for 7+ days
    else if (lastActivity.toISOString() < sevenDaysAgo) {
      stalled = true
      reason = 'No activity for 7+ days'
    }
    // Rule 5: no next action scheduled and past initial contact
    else if (!hasNextAction && o.status !== 'new_enquiry') {
      stalled = true
      reason = 'No next action scheduled'
    }

    // Apply
    const { data: cur } = await db.from('opportunities').select('is_stalled').eq('id', o.id).single()
    if (stalled && !cur?.is_stalled) {
      await db.from('opportunities').update({ is_stalled: true, stalled_reason: reason }).eq('id', o.id)
      flagged++
    } else if (!stalled && cur?.is_stalled) {
      await db.from('opportunities').update({ is_stalled: false, stalled_reason: null }).eq('id', o.id)
      cleared++
    } else if (stalled && cur?.is_stalled) {
      // keep reason current
      await db.from('opportunities').update({ stalled_reason: reason }).eq('id', o.id)
    }
  }

  return NextResponse.json({ checked: (active || []).length, flagged, cleared })
}
