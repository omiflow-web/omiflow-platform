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
  if (config.voiceId) body.voice = { provider: '11labs', voiceId: config.voiceId }

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

export async function updateVapiAssistantWithKnowledge(
  assistantId: string,
  firmName: string,
  practiceAreas: string[],
  knowledgeBaseContext: string
): Promise<void> {
  const systemPrompt = buildSystemPrompt(firmName, practiceAreas, knowledgeBaseContext)
  await updateVapiAssistant(assistantId, { systemPrompt })
}

export function buildSystemPrompt(
  firmName: string,
  practiceAreas: string[],
  additionalContext?: string,
  languages?: string[]
): string {
  const langNote = languages && languages.length > 1
    ? `You can assist callers in: ${languages.join(', ')}. Detect the caller's language and respond in it naturally.`
    : 'You assist callers in English.'

  return `You are the AI receptionist for ${firmName}, a professional law firm.

Your role is to:
1. Welcome the caller warmly and professionally
2. Collect their name, best callback number, and reason for calling
3. Answer questions about the firm using the knowledge provided below
4. Reassure callers that a qualified team member will follow up promptly
5. If the caller wants to book a consultation, note their preferred time

FIRM PRACTICE AREAS:
${practiceAreas.length > 0 ? practiceAreas.join(', ') : 'General legal services'}

${langNote}

CRITICAL RULES:
- Never provide specific legal advice — always say a qualified solicitor will advise them
- Always confirm the callback number clearly by repeating it back
- If someone mentions urgency, a court date, or deportation — express empathy and note it as urgent
- Be warm, professional, and concise — do not ramble
- If you cannot answer a question, say "I'll make sure the team has your question noted for when they call you back"
- Never make up information about fees, timelines, or outcomes

${additionalContext ? `\nFIRM INFORMATION AND DOCUMENTS:\n${additionalContext}` : ''}

CALL STRUCTURE:
1. Greet the caller warmly
2. Ask how you can help
3. Listen to their matter
4. Answer any factual questions from the firm information above
5. Collect: full name, callback number, brief summary of their matter
6. If urgent, acknowledge the urgency and reassure them the team will prioritise their call
7. Close: "I've noted all your details and a member of the ${firmName} team will be in touch shortly. Is there anything else before I let you go?"

Always end by confirming you've taken their details and that the team will be in touch.`
}
