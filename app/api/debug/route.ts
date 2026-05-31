import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Simple diagnostic endpoint - remove in production
export async function GET(request: NextRequest) {
  try {
    const db = createServiceClient() as any

    const [orgs, phones, aiConfigs, calls, leads] = await Promise.all([
      db.from('organizations').select('id, name, slug').limit(10),
      db.from('phone_numbers').select('number, organization_id, is_active').limit(10),
      db.from('organization_ai_configs').select('organization_id, vapi_assistant_id').limit(10),
      db.from('calls').select('id, caller_number, handled_by, status, created_at').order('created_at', { ascending: false }).limit(5),
      db.from('leads').select('id, phone, status, priority, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: {
        supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        twilio_sid: !!process.env.TWILIO_ACCOUNT_SID,
        twilio_number: process.env.TWILIO_PHONE_NUMBER,
        vapi_key: !!process.env.VAPI_PRIVATE_KEY,
        anthropic_key: !!process.env.ANTHROPIC_API_KEY,
        resend_key: !!process.env.RESEND_API_KEY,
        app_url: process.env.NEXT_PUBLIC_APP_URL,
      },
      data: {
        organizations: orgs.data,
        phone_numbers: phones.data,
        ai_configs: aiConfigs.data,
        recent_calls: calls.data,
        recent_leads: leads.data,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }
}
