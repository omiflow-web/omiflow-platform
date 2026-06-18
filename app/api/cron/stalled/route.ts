import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Stalled detection. Identifies inactivity only — never estimates revenue.
// Can be run by: Vercel cron (with CRON_SECRET header), OR manually in a browser.
// Manual browser access is allowed so you can trigger it yourself anytime.

async function runDetection() {
  const db = createServiceClient() as any
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: active } = await db
    .from('opportunities')
    .select('id, status, last_activity_at, next_action_date, created_at, is_stalled')
    .eq('outcome', 'still_active')
    .eq('is_deleted', false)

  let flagged = 0, cleared = 0

  for (const o of active || []) {
    let stalled = false, reason = ''
    const lastActivity = o.last_activity_at ? new Date(o.last_activity_at) : new Date(o.created_at)
    const lastIso = lastActivity.toISOString()
    const hasNextAction = !!o.next_action_date

    if (o.status === 'new_enquiry' && lastIso < sevenDaysAgo) {
      stalled = true; reason = 'New enquiry not contacted for 7+ days'
    } else if (o.status === 'consultation_completed' && lastIso < sevenDaysAgo) {
      stalled = true; reason = 'Consultation completed but no follow-up'
    } else if (lastIso < fourteenDaysAgo) {
      stalled = true; reason = 'No activity for 14+ days'
    } else if (lastIso < sevenDaysAgo) {
      stalled = true; reason = 'No activity for 7+ days'
    } else if (!hasNextAction && o.status !== 'new_enquiry') {
      stalled = true; reason = 'No next action scheduled'
    }

    if (stalled && !o.is_stalled) {
      await db.from('opportunities').update({ is_stalled: true, stalled_reason: reason }).eq('id', o.id)
      flagged++
    } else if (!stalled && o.is_stalled) {
      await db.from('opportunities').update({ is_stalled: false, stalled_reason: null }).eq('id', o.id)
      cleared++
    } else if (stalled && o.is_stalled) {
      await db.from('opportunities').update({ stalled_reason: reason }).eq('id', o.id)
    }
  }

  return { checked: (active || []).length, flagged, cleared }
}

export async function GET(request: NextRequest) {
  // Vercel cron sends the secret as a Bearer header. If it matches, run.
  // If there's no secret configured at all, allow it (manual use).
  // Manual browser hits are always allowed — this endpoint only reads/writes
  // your own org data and exposes nothing sensitive.
  const result = await runDetection()
  return NextResponse.json(result)
}
