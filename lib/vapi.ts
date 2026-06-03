const VAPI_API = 'https://api.vapi.ai'

// The master template assistant ID — all new assistants are duplicated from this
const TEMPLATE_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || 'ab8e47dc-2373-433f-8ba1-208d32c02242'

async function vapiRequest(method: string, path: string, body?: any) {
  const res = await fetch(`${VAPI_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vapi ${method} ${path} failed: ${err}`)
  }
  return res.json()
}

// Fetch the template assistant so we can duplicate its exact settings
async function getTemplateAssistant() {
  return vapiRequest('GET', `/assistant/${TEMPLATE_ASSISTANT_ID}`)
}

// Create a brand new assistant for a firm by duplicating the template
// and injecting the firm's name into the greeting and system prompt
export async function createVapiAssistantForOrg(firmName: string): Promise<string> {
  const template = await getTemplateAssistant()

  // Replace {{firmName}} placeholders with the real firm name
  const firstMessage = (template.firstMessage || 'Hi, thank you for calling {{firmName}}. How can I help?')
    .replace(/\{\{firmName\}\}/g, firmName)

  const systemPrompt = (template.model?.messages?.[0]?.content || '')
    .replace(/\{\{firmName\}\}/g, firmName)

  // Build the new assistant using the exact same settings as the template
  const newAssistant = await vapiRequest('POST', '/assistant', {
    name: `${firmName} Receptionist`,
    firstMessage,
    model: {
      ...template.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ]
    },
    voice: template.voice,
    transcriber: template.transcriber,
    maxDurationSeconds: template.maxDurationSeconds || 600,
    recordingEnabled: template.recordingEnabled ?? true,
    silenceTimeoutSeconds: template.silenceTimeoutSeconds || 21,
    endCallMessage: template.endCallMessage || 'Thanks for calling — someone will be in touch shortly.',
    endCallPhrases: template.endCallPhrases || ['goodbye', 'take care', 'have a good day'],
    serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi`,
    serverMessages: template.serverMessages || ['end-of-call-report'],
    clientMessages: template.clientMessages || [],
    metadata: {},
  })

  return newAssistant.id
}

// Update an existing assistant when firm name or knowledge changes
export async function updateVapiAssistant(
  assistantId: string,
  updates: { firmName?: string; systemPrompt?: string; firstMessage?: string; voiceId?: string }
): Promise<void> {
  const body: any = {}

  if (updates.firstMessage) {
    body.firstMessage = updates.firstMessage.replace(/\{\{firmName\}\}/g, updates.firmName || '')
  }

  if (updates.systemPrompt) {
    body.model = {
      messages: [{
        role: 'system',
        content: updates.systemPrompt.replace(/\{\{firmName\}\}/g, updates.firmName || '')
      }]
    }
  }

  if (updates.voiceId) {
    body.voice = { provider: '11labs', voiceId: updates.voiceId }
  }

  await vapiRequest('PATCH', `/assistant/${assistantId}`, body)
}

// Delete an assistant when a firm is offboarded
export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  await vapiRequest('DELETE', `/assistant/${assistantId}`)
}

// Pass org context into Vapi when a call starts via Twilio
// This means the end-of-call webhook knows exactly which org the call belongs to
export function buildVapiCallMetadata(organizationId: string, firmName: string) {
  return {
    organizationId,
    firmName
  }
}

export function buildSystemPrompt(firmName: string, practiceAreas: string[], additionalContext?: string): string {
  return `[Identity]
You are the receptionist for ${firmName}. You are warm, calm, and natural, ensuring each caller feels genuinely welcomed and cared for. Never mention being AI or a virtual assistant unless asked directly.

[Style]
Speak in a friendly, conversational tone — never scripted, robotic, or formal.
Use natural, gentle language. Respond in a single sentence at a time and pause for the caller after each turn.
Match the caller's energy: softer and more patient for callers who sound stressed or uncertain; more concise and direct for callers who sound rushed or businesslike.
Never repeat the business name after your opening greeting.
Use contractions naturally — "I'll", "they're", "you're" — to sound human.

[Opening]
Open every call with exactly this, once only:
"Hi, thank you for calling ${firmName}. How can I help?"

[Listening and Follow-Up]
After the caller explains their reason for calling, acknowledge what they said and ask one thoughtful, relevant follow-up question.

[Explaining Team Availability]
"The team are with a client at the moment, but I can take your details and make sure the right person calls you back within the next couple of hours."

[Collecting Details]
Take name and callback number only, one at a time.

[Closing]
End every call with a single warm, natural phrase:
"Thanks for calling — someone will be in touch shortly."

${practiceAreas.length > 0 ? `\nPRACTICE AREAS:\n${practiceAreas.join(', ')}` : ''}
${additionalContext ? `\nFIRM INFORMATION:\n${additionalContext}` : ''}`
}

// Updates a firm's Vapi assistant with their latest knowledge base content
// Called every time a document is uploaded, edited, or deleted
export async function updateVapiAssistantKnowledge(
  assistantId: string,
  firmName: string,
  practiceAreas: string[],
  knowledgeContext: string
): Promise<void> {
  const systemPrompt = buildSystemPrompt(firmName, practiceAreas, knowledgeContext)
  await vapiRequest('PATCH', `/assistant/${assistantId}`, {
    model: {
      messages: [{
        role: 'system',
        content: systemPrompt
      }]
    }
  })
}
