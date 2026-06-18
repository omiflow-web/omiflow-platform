import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Inbound enquiry endpoint - turns an email or website form into an opportunity.
// Seamless: the client forwards enquiry emails here, or points their contact form at this URL.
// Their inbox and website stay exactly as they are. A copy flows in and becomes an opportunity
// that lands on the dashboard identically to a phone call or manual entry.

async function resolveOrg(db: any, body: any): Promise<string | null> {
  if (body.org) {
    const { data: byId } = await db.from('organizations').select('id').eq('id', body.org).maybeSingle()
    if (byId?.id) return byId.id
    const { data: byKey } = await db.from('organizations').select('id').eq('inbound_key', body.org).maybeSingle()
    if (byKey?.id) return byKey.id
  }
  if (body.to) {
    const { data: byTo } = await db.from('organizations').select('id').eq('inbound_email', body.to).maybeSingle()
    if (byTo?.id) return byTo.id
  }
  return null
}

function splitName(full?: string): { first: string | null, last: string | null } {
  if (!full) return { first: null, last: null }
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const db = createServiceClient() as any
  const orgId = await resolveOrg(db, body)
  if (!orgId) return NextResponse.json({ error: 'Could not resolve organization' }, { status: 400 })

  const isEmail = !!(body.from_email || body.subject || body.from_name)
  const name = splitName(body.from_name || [body.first_name, body.last_name].filter(Boolean).join(' '))
  const email = body.from_email || body.email || null
  const phone = body.phone || null
  const source = isEmail ? 'email' : 'website'
  const enquiryType = body.enquiry_type || body.subject || null
  const notes = body.body || body.message || null

  const { data, error } = await db.from('opportunities').insert({
    organization_id: orgId,
    first_name: name.first || body.first_name || null,
    last_name: name.last || body.last_name || null,
    email,
    phone,
    enquiry_type: enquiryType,
    source,
    status: 'new_enquiry',
    priority: 'medium',
    outcome: 'still_active',
    notes,
    first_contact_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    is_deleted: false
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('notifications').insert({
    organization_id: orgId,
    opportunity_id: data.id,
    type: 'new_enquiry',
    message: `New ${source} enquiry${enquiryType ? `: ${enquiryType}` : ''}`
  }).then(() => {}, () => {})

  return NextResponse.json({ success: true, id: data.id })
}
