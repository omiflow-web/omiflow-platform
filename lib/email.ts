import { Resend } from 'resend'
import { AIProcessingResult } from './ai-pipeline'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendCallSummaryEmail(
  recipients: string[],
  firmName: string,
  callerNumber: string,
  result: AIProcessingResult,
  callDurationSeconds: number
): Promise<void> {
  if (!recipients || recipients.length === 0) return

  const duration = `${Math.floor(callDurationSeconds / 60)}m ${callDurationSeconds % 60}s`
  const priorityLabel = result.leadQuality.toUpperCase()
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const body = `NEW ENQUIRY — ${firmName}
${now}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALLER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${result.callerName || 'Unknown'}
Phone: ${callerNumber}
Callback Number: ${result.callerCallbackNumber || callerNumber}
Call Duration: ${duration}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Priority: ${priorityLabel}
Sentiment: ${result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1)}
Practice Area: ${result.practiceArea}
Lead Score: ${result.leadScore}/100
Urgency Score: ${result.urgencyScore}/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${result.summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${result.recommendation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY POINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${result.keyPoints.map(p => `• ${p}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Omiflow — No lead is ever forgotten.
View full call details at app.omiflow.co`

  await resend.emails.send({
    from: 'Omiflow <notifications@omiflow.co>',
    to: recipients,
    subject: `[${priorityLabel}] New ${result.practiceArea} Enquiry — ${result.callerName || callerNumber}`,
    text: body
  })
}

export async function sendStaffNotificationEmail(
  recipientEmail: string,
  subject: string,
  message: string,
  firmName: string
): Promise<void> {
  await resend.emails.send({
    from: 'Omiflow <notifications@omiflow.co>',
    to: recipientEmail,
    subject: `[Omiflow] ${subject}`,
    text: `${message}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPowered by Omiflow for ${firmName}\napp.omiflow.co`
  })
}

export async function sendWelcomeEmail(
  recipientEmail: string,
  firmName: string,
  tempPassword: string
): Promise<void> {
  await resend.emails.send({
    from: 'Omiflow <hello@omiflow.co>',
    to: recipientEmail,
    subject: `Welcome to Omiflow — Your ${firmName} portal is ready`,
    text: `Welcome to Omiflow.

Your firm portal for ${firmName} is now active.

Login at: ${process.env.NEXT_PUBLIC_APP_URL}
Email: ${recipientEmail}
Temporary Password: ${tempPassword}

Please change your password after your first login.

If you have any questions, reply to this email.

The Omiflow Team`
  })
}
