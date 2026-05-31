import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RAGResult {
  answer: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low' | 'none'
}

// Search the knowledge base and generate an answer using Claude
export async function searchAndAnswer(
  organizationId: string,
  question: string
): Promise<RAGResult> {
  const db = createServiceClient() as any

  // Search knowledge base using full text search
  const { data: chunks } = await db.rpc('search_knowledge_base', {
    org_id: organizationId,
    query_text: question,
    max_results: 5
  })

  if (!chunks || chunks.length === 0) {
    return {
      answer: '',
      sources: [],
      confidence: 'none'
    }
  }

  // Build context from top chunks
  const context = chunks.map((c: any, i: number) =>
    `[Source ${i + 1}: ${c.document_title}]\n${c.content}`
  ).join('\n\n---\n\n')

  const sources = Array.from(new Set(chunks.map((c: any) => c.document_title))) as string[]

  // Use Claude to generate a precise answer
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are answering a question on behalf of a law firm using their own documents.

QUESTION: ${question}

RELEVANT INFORMATION FROM FIRM DOCUMENTS:
${context}

Instructions:
- Answer the question directly and concisely using ONLY the information provided
- If the documents don't contain enough information to answer fully, say so
- Keep your answer under 3 sentences
- Use specific details from the documents (prices, timeframes, requirements)
- Do not add information that isn't in the documents
- Do not give legal advice — present information factually

Answer:`
    }]
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  // Determine confidence based on relevance scores
  const maxRank = Math.max(...chunks.map((c: any) => c.rank || 0))
  const confidence = maxRank > 0.3 ? 'high' : maxRank > 0.1 ? 'medium' : 'low'

  return { answer, sources, confidence }
}

// Get all knowledge base content for Vapi system prompt context
export async function getKnowledgeBaseContext(organizationId: string): Promise<string> {
  const db = createServiceClient() as any

  const { data: documents } = await db
    .from('knowledge_documents')
    .select('title, content_text')
    .eq('organization_id', organizationId)
    .eq('is_processed', true)
    .limit(10)

  if (!documents || documents.length === 0) return ''

  const context = documents.map((doc: any) =>
    `=== ${doc.title} ===\n${doc.content_text?.slice(0, 2000) || ''}`
  ).join('\n\n')

  return `\n\nFIRM KNOWLEDGE BASE:\n${context}`
}
