import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateVapiFallbackTwiML } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')
    const orgId = searchParams.get('orgId')
    const assistantId = searchParams.get('assistantId')

    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string

    const supabase = createServiceClient()

    // If human answered, update call record
    if (dialCallStatus === 'completed') {
      await supabase.from('calls').update({
        handled_by: 'human',
        status: 'completed',
        ended_at: new Date().toISOString()
      }).eq('id', callId)

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Human didn't answer — hand to Vapi AI
    if (!assistantId) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please leave a message or call back later.</Say></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Update call to show it went to AI
    await supabase.from('calls').update({
      handled_by: 'ai'
    }).eq('id', callId)

    const twiml = generateVapiFallbackTwiML(assistantId)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Twilio fallback error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are sorry, please call back shortly.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
