import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

// Helper: resolve the caller's org
async function getOrg(cookieStore: any) {
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: userData } = await supabase
    .from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return { error: 'No organization', status: 403 as const }
  return { orgId, userId: user.id }
}

// CREATE a new opportunity (manual entry)
export async function POST(request: NextRequest) {
  const ctx = await getOrg(cookies())
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await request.json()
  const db = createServiceClient() as any

  const { data, error } = await db.from('opportunities').insert({
    organization_id: ctx.orgId,
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    company_name: body.company_name || null,
    phone: body.phone || null,
    email: body.email || null,
    enquiry_type: body.enquiry_type || null,
    source: body.source || 'manual',
    status: body.status || 'new_enquiry',
    priority: body.priority || 'medium',
    outcome: 'still_active',
    owner_id: body.owner_id || ctx.userId,
    next_action_date: body.next_action_date || null,
    next_action_note: body.next_action_note || null,
    notes: body.notes || null,
    first_contact_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    is_deleted: false
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// UPDATE an opportunity
export async function PATCH(request: NextRequest) {
  const ctx = await getOrg(cookies())
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = createServiceClient() as any

  // Build a clean update object — only allowed fields
  const update: any = { last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const allowed = ['status','priority','owner_id','next_action_date','next_action_note','outcome','reason_lost','notes','appointment_date','enquiry_type','first_name','last_name','company_name','phone','email']
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  // Keep outcome in sync when status moves to a terminal state
  if (fields.status === 'customer') update.outcome = 'customer'
  if (fields.status === 'lost') update.outcome = 'lost'
  if (fields.status === 'not_suitable') update.outcome = 'not_suitable'
  // If moving back into the pipeline, reactivate
  if (fields.status && !['customer','lost','not_suitable'].includes(fields.status)) {
    update.outcome = 'still_active'
    update.is_stalled = false
  }

  // Bump follow_up_count when a new next action is logged
  if (fields.increment_follow_up) {
    const { data: cur } = await db.from('opportunities').select('follow_up_count').eq('id', id).single()
    update.follow_up_count = ((cur?.follow_up_count) || 0) + 1
  }

  const { error } = await db.from('opportunities')
    .update(update).eq('id', id).eq('organization_id', ctx.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log status change to history
  if (fields.status) {
    await db.from('opportunity_status_history').insert({
      organization_id: ctx.orgId,
      opportunity_id: id,
      status: fields.status
    }).then(() => {}, () => {})
  }

  return NextResponse.json({ success: true })
}
