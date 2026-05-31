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
    ? template
        .replace('{firm_name}', firmName)
        .replace('{callback_hours}', String(callbackHours))
    : `Thank you for contacting ${firmName}. A member of our team will call you back within ${callbackHours} hours.`

  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: toNumber
  })
}

export async function sendStaffSMS(toNumber: string, message: string): Promise<void> {
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: toNumber
  })
}

// Rings the firm's number first, then falls back to Vapi if no answer
export function generateInboundTwiML(
  forwardTo: string,
  fallbackUrl: string,
  ringCount: number = 3
): string {
  const ringTimeout = ringCount * 6
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${ringTimeout}" action="${fallbackUrl}" method="POST">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`
}

// Goes straight to Vapi AI — used after hours or when no forward number set
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

// Used by fallback when human doesn't answer — redirects to Vapi
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

export function isBusinessHours(businessHours: any, timezone: string): boolean {
  if (!businessHours?.enabled) return true

  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
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
    if (!dayHours) return false

    return currentTime >= dayHours.open && currentTime <= dayHours.close
  } catch {
    return true // Default to open if timezone parsing fails
  }
}
