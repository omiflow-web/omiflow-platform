import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function sendConfirmationSMS(
  toNumber: string,
  firmName: string,
  callbackHours: number = 2,
  template?: string
): Promise<void> {
  const body = template
    ? template.replace('{firm_name}', firmName).replace('{callback_hours}', String(callbackHours))
    : `Thank you for contacting ${firmName}. A member of our team will call you back within ${callbackHours} hours. — Omiflow`

  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber
  })
}

export async function sendStaffSMS(
  toNumber: string,
  message: string
): Promise<void> {
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber
  })
}

// TwiML for inbound call routing
// Rings the firm's number first, then falls back to Vapi
export function generateInboundTwiML(
  forwardTo: string,
  vapiWebhookUrl: string,
  ringCount: number = 3
): string {
  const ringTimeout = ringCount * 6 // ~6 seconds per ring

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${ringTimeout}" action="${vapiWebhookUrl}" method="POST">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`
}

// TwiML when firm doesn't answer — redirect to Vapi
export function generateVapiFallbackTwiML(vapiAssistantId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai/v1/call/twilio">
      <Parameter name="assistant_id" value="${vapiAssistantId}" />
    </Stream>
  </Connect>
</Response>`
}

// TwiML for after-hours — goes straight to Vapi
export function generateAfterHoursTwiML(vapiAssistantId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai/v1/call/twilio">
      <Parameter name="assistant_id" value="${vapiAssistantId}" />
    </Stream>
  </Connect>
</Response>`
}

export function isBusinessHours(businessHours: any, timezone: string): boolean {
  if (!businessHours?.enabled) return true // If not configured, always treat as business hours

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const currentTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  const dayHours = businessHours.hours?.[weekday]
  if (!dayHours) return false // Closed on this day

  return currentTime >= dayHours.open && currentTime <= dayHours.close
}
