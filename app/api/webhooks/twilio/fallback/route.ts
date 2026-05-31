import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateVapiFallbackTwiML } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')
    const assistantId = searchParams.get('assistantId')

    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string

    console.log(`📞 Twilio fallback: callId=${callId}, dialStatus=${dialCallStatus}, assistantId=${assistantId}`)

    const db = createServiceClient() as any

    // Human answered — mark call as human handled and done
    if (dialCallStatus === 'completed') {
      await db.from('calls').update({
        handled_by: 'human',
        status: 'completed',
        ended_at: new Date().toISOString()
      }).eq('id', callId)

      console.log(`👤 Human answered call ${callId}`)

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Human didn't answer — hand to Vapi AI
    if (!assistantId) {
      console.error('No assistantId — cannot redirect to Vapi')
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Please leave a message or call back later.</Say>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    await db.from('calls').update({ handled_by: 'ai' }).eq('id', callId)

    console.log(`🤖 No human answer — redirecting to Vapi AI assistant ${assistantId}`)

    const twiml = generateVapiFallbackTwiML(assistantId)
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })

  } catch (error: any) {
    console.error('Twilio fallback error:', error)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We are sorry, please call back shortly.</Say>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
