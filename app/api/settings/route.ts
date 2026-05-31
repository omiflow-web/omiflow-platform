import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { updateVapiAssistant, buildSystemPrompt } from '@/lib/vapi'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const [settings, aiConfig, practiceAreas] = await Promise.all([
    db.from('organization_settings').select('*').eq('organization_id', orgId).single(),
    db.from('organization_ai_configs').select('*').eq('organization_id', orgId).single(),
    db.from('practice_areas').select('*').eq('organization_id', orgId).eq('is_active', true)
  ])

  return NextResponse.json({
    settings: settings.data,
    aiConfig: aiConfig.data,
    practiceAreas: practiceAreas.data
  })
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
  const { type, data } = body
  const db = createServiceClient() as any

  if (type === 'settings') {
    await db.from('organization_settings').update({
      ...data,
      updated_at: new Date().toISOString()
    }).eq('organization_id', orgId)
  }

  if (type === 'ai_config') {
    await db.from('organization_ai_configs').update({
      ...data,
      updated_at: new Date().toISOString()
    }).eq('organization_id', orgId)

    // Sync changes to Vapi if assistant exists
    if (data.vapi_assistant_id || data.greeting_message || data.system_prompt) {
      try {
        const { data: aiConfig } = await db.from('organization_ai_configs').select('*').eq('organization_id', orgId).single()
        const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()
        const { data: practiceAreas } = await db.from('practice_areas').select('name').eq('organization_id', orgId).eq('is_active', true)

        if (aiConfig?.vapi_assistant_id) {
          const practiceAreaNames = (practiceAreas || []).map((p: any) => p.name)
          const systemPrompt = buildSystemPrompt(org?.name || '', practiceAreaNames)
          await updateVapiAssistant(aiConfig.vapi_assistant_id, {
            firstMessage: data.greeting_message || aiConfig.greeting_message,
            systemPrompt: data.system_prompt || systemPrompt
          })
        }
      } catch (vapiError) {
        console.error('Vapi update failed:', vapiError)
      }
    }
  }

  return NextResponse.json({ success: true })
}
