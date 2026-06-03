import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { createVapiAssistantForOrg } from '@/lib/vapi'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const { data: orgs } = await db.from('organizations').select(`
    *,
    billing_subscriptions(plan, status),
    organization_ai_configs(vapi_assistant_id),
    users(count)
  `).order('created_at', { ascending: false })

  return NextResponse.json({ organizations: orgs || [] })
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, slug, industry, ownerEmail, ownerFirstName, ownerLastName, ownerPassword } = body

  if (!name || !slug) return NextResponse.json({ error: 'Name and slug required' }, { status: 400 })

  const db = createServiceClient() as any

  // 1. Create the organisation
  const { data: org, error: orgError } = await db.from('organizations').insert({
    name,
    slug,
    industry: industry || 'legal',
    is_active: true
  }).select().single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message || 'Failed to create organisation' }, { status: 500 })
  }

  // 2. Create a Vapi assistant specifically for this firm
  // Duplicates the template assistant with this firm's name injected
  let vapiAssistantId = null
  try {
    vapiAssistantId = await createVapiAssistantForOrg(name)
    console.log(`✅ Created Vapi assistant ${vapiAssistantId} for ${name}`)
  } catch (vapiError: any) {
    console.error(`⚠️ Vapi assistant creation failed for ${name}:`, vapiError.message)
    // Non-fatal — org is still created, assistant can be added manually
  }

  // 3. Create organisation settings
  await db.from('organization_settings').insert({
    organization_id: org.id,
    callback_promise_hours: 2,
    escalation_hours: 24,
    auto_sms_enabled: true,
    auto_email_enabled: true,
    auto_task_creation: true
  })

  // 4. Create AI config with the new firm-specific assistant
  await db.from('organization_ai_configs').insert({
    organization_id: org.id,
    vapi_assistant_id: vapiAssistantId,
    assistant_name: `${name} Receptionist`,
    greeting_message: `Hi, thank you for calling ${name}. How can I help?`,
    collect_name: true,
    collect_callback_number: true,
    collect_reason: true,
    use_knowledge_base: true,
    book_appointments: false
  })

  // 5. Create knowledge base
  const { data: kb } = await db.from('knowledge_bases').insert({
    organization_id: org.id,
    name: 'Main Knowledge Base'
  }).select().single()

  // 6. Create billing record
  await db.from('billing_subscriptions').insert({
    organization_id: org.id,
    plan: 'starter',
    status: 'trialing'
  })

  // 7. Create owner user account if email provided
  let ownerUser = null
  if (ownerEmail) {
    try {
      const { data: authUser } = await db.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword || Math.random().toString(36).slice(-10) + 'A1!',
        email_confirm: true
      })

      if (authUser?.user) {
        const { data: ownerRole } = await db.from('roles').select('id').eq('name', 'owner').single()
        await db.from('users').insert({
          id: authUser.user.id,
          organization_id: org.id,
          role_id: ownerRole?.id,
          role_name: 'owner',
          first_name: ownerFirstName || '',
          last_name: ownerLastName || '',
          email: ownerEmail
        })
        ownerUser = { email: ownerEmail, password: ownerPassword }
      }
    } catch (userError: any) {
      console.error('Owner user creation failed:', userError.message)
    }
  }

  return NextResponse.json({
    organization: org,
    vapiAssistantId,
    ownerUser,
    message: `${name} created successfully with its own Vapi assistant`
  })
}
