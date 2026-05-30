import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { createVapiAssistant, buildSystemPrompt } from '@/lib/vapi'
import { sendWelcomeEmail } from '@/lib/email'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!userData?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = createServiceClient()
  const { data: orgs } = await serviceClient
    .from('organizations')
    .select('*, billing_subscriptions(*), users(count)')
    .order('created_at', { ascending: false })

  return NextResponse.json({ organizations: orgs })
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!userData?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, industry, ownerEmail, ownerFirstName, ownerLastName, ownerPhone, phoneNumber, practiceAreas } = body

  const serviceClient = createServiceClient()

  // Create slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

  // Create organization
  const { data: org, error: orgError } = await serviceClient
    .from('organizations')
    .insert({ name, slug, industry: industry || 'immigration_law' })
    .select()
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message || 'Failed to create org' }, { status: 500 })
  }

  // Provision org (practice areas, settings, etc.)
  await serviceClient.rpc('provision_organization', {
    org_id: org.id,
    industry_type: industry || 'immigration_law'
  })

  // Create owner user in Supabase Auth
  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
  const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    email_confirm: true
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }

  // Get owner role
  const { data: ownerRole } = await serviceClient.from('roles').select('id').eq('name', 'owner').single()

  // Create user record
  await serviceClient.from('users').insert({
    id: authUser.user.id,
    organization_id: org.id,
    role_id: ownerRole?.id,
    first_name: ownerFirstName,
    last_name: ownerLastName,
    email: ownerEmail,
    phone: ownerPhone
  })

  // Create staff member record
  await serviceClient.from('staff_members').insert({
    organization_id: org.id,
    user_id: authUser.user.id,
    role_id: ownerRole?.id,
    first_name: ownerFirstName,
    last_name: ownerLastName,
    email: ownerEmail,
    phone: ownerPhone
  })

  // Update settings with notification email
  await serviceClient.from('organization_settings').update({
    notification_email: ownerEmail,
    email_summary_recipients: [ownerEmail]
  }).eq('organization_id', org.id)

  // Create Vapi assistant
  try {
    const areas = practiceAreas || ['General Enquiry']
    const systemPrompt = buildSystemPrompt(name, areas)

    const vapiAssistantId = await createVapiAssistant({
      name: `${name} — AI Receptionist`,
      firstMessage: `Thank you for calling ${name}. I'm the virtual assistant — how can I help you today?`,
      systemPrompt
    })

    await serviceClient.from('organization_ai_configs').update({
      vapi_assistant_id: vapiAssistantId
    }).eq('organization_id', org.id)
  } catch (vapiError) {
    console.error('Vapi assistant creation failed:', vapiError)
    // Non-fatal — can be configured later
  }

  // Add phone number if provided
  if (phoneNumber) {
    await serviceClient.from('phone_numbers').insert({
      organization_id: org.id,
      number: phoneNumber,
      is_primary: true,
      forward_to: ownerPhone || null
    })
  }

  // Create billing subscription record
  await serviceClient.from('billing_subscriptions').insert({
    organization_id: org.id,
    plan: 'starter',
    status: 'trialing',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  })

  // Send welcome email
  try {
    await sendWelcomeEmail(ownerEmail, name, tempPassword)
  } catch (emailError) {
    console.error('Welcome email failed:', emailError)
  }

  return NextResponse.json({ success: true, organization: org, tempPassword })
}
