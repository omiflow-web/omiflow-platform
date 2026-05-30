export interface VapiAssistantConfig {
  name: string
  firstMessage: string
  systemPrompt: string
  voiceId?: string
  language?: string
  maxDurationSeconds?: number
}

export async function createVapiAssistant(config: VapiAssistantConfig): Promise<string> {
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: config.name,
      firstMessage: config.firstMessage,
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        systemPrompt: config.systemPrompt,
        temperature: 0.7
      },
      voice: {
        provider: '11labs',
        voiceId: config.voiceId || 'jennifer'
      },
      transcriber: {
        provider: 'deepgram',
        language: config.language || 'en'
      },
      maxDurationSeconds: config.maxDurationSeconds || 600,
      recordingEnabled: true,
      endCallFunctionEnabled: true,
      fillersEnabled: true
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create Vapi assistant: ${error}`)
  }

  const data = await response.json()
  return data.id
}

export async function updateVapiAssistant(
  assistantId: string,
  config: Partial<VapiAssistantConfig>
): Promise<void> {
  const body: any = {}

  if (config.name) body.name = config.name
  if (config.firstMessage) body.firstMessage = config.firstMessage
  if (config.systemPrompt) body.model = { systemPrompt: config.systemPrompt }

  const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update Vapi assistant: ${error}`)
  }
}

export function buildSystemPrompt(
  firmName: string,
  practiceAreas: string[],
  additionalContext?: string,
  languages?: string[]
): string {
  const langNote = languages && languages.length > 1
    ? `You can assist callers in: ${languages.join(', ')}. Detect the caller's language and respond in it.`
    : 'You assist callers in English.'

  return `You are the AI receptionist for ${firmName}, a law firm.

Your role is to:
1. Welcome the caller warmly and professionally
2. Collect their name, best callback number, and reason for calling
3. Answer questions about the firm using the knowledge provided
4. Book consultations if the caller requests one
5. Reassure callers that a team member will follow up promptly

FIRM PRACTICE AREAS:
${practiceAreas.join(', ')}

${langNote}

IMPORTANT RULES:
- Never provide specific legal advice
- Always reassure callers that a qualified solicitor will call them back
- If someone mentions an emergency or crisis, express empathy and mark as urgent
- Be warm, professional, and concise
- Always confirm the callback number clearly
- If you cannot answer a question, say "I'll make sure the team has this question noted for when they call you back"

${additionalContext ? `FIRM INFORMATION:\n${additionalContext}` : ''}

When the call ends, you will have collected:
- Caller's name
- Best callback number  
- Reason for calling
- Any urgency factors

End every call by confirming: "I've noted all your details and a member of the ${firmName} team will be in touch shortly. Is there anything else before I let you go?"`
}
