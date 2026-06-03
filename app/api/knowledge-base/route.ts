import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import { extractTextFromBuffer } from '@/lib/document-extractor'
import { updateVapiAssistantKnowledge } from '@/lib/vapi'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const { data: kb } = await db.from('knowledge_bases').select('*').eq('organization_id', orgId).single()
  const { data: documents } = await db.from('knowledge_documents').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })

  return NextResponse.json({ knowledgeBase: kb, documents: documents || [] })
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md']
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()

  if (!allowedExtensions.includes(ext)) {
    return NextResponse.json({ error: 'File type not supported. Use PDF, Word, or plain text.' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
  }

  const db = createServiceClient() as any
  const { data: kb } = await db.from('knowledge_bases').select('id').eq('organization_id', orgId).single()
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentText = await extractTextFromBuffer(buffer, ext, file.name)

  const storagePath = `${orgId}/${Date.now()}-${file.name}`
  await supabase.storage.from('knowledge-documents').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream'
  }).catch(console.error)

  const { data: doc } = await db.from('knowledge_documents').insert({
    organization_id: orgId,
    knowledge_base_id: kb.id,
    title: file.name.replace(/\.[^/.]+$/, ''),
    file_name: file.name,
    file_type: ext,
    file_size_bytes: file.size,
    storage_path: storagePath,
    content_text: contentText,
    uploaded_by: user.id,
    is_processed: false
  }).select().single()

  if (!doc) return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })

  await processDocument(doc.id, orgId, kb.id, contentText, db)

  // Sync all knowledge base content into this firm's Vapi assistant
  // This is what makes the AI use the new information during calls
  await syncKnowledgeBaseToVapi(orgId, db)

  const { data: updated } = await db.from('knowledge_documents').select('*').eq('id', doc.id).single()
  return NextResponse.json({ document: updated })
}

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'No document ID' }, { status: 400 })

  const db = createServiceClient() as any
  await db.from('knowledge_chunks').delete().eq('document_id', docId)
  await db.from('knowledge_documents').delete().eq('id', docId).eq('organization_id', orgId)

  // Re-sync after deletion so removed info is no longer in the assistant
  await syncKnowledgeBaseToVapi(orgId, db)

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'No document ID' }, { status: 400 })

  const body = await request.json()
  const { title, content_text } = body
  const db = createServiceClient() as any

  if (content_text) {
    await db.from('knowledge_chunks').delete().eq('document_id', docId)
    const { data: doc } = await db.from('knowledge_documents').select('knowledge_base_id').eq('id', docId).single()
    if (doc) await processDocument(docId, orgId, doc.knowledge_base_id, content_text, db)
    await db.from('knowledge_documents').update({
      ...(title && { title }),
      content_text,
      updated_at: new Date().toISOString()
    }).eq('id', docId).eq('organization_id', orgId)
  } else if (title) {
    await db.from('knowledge_documents').update({ title }).eq('id', docId).eq('organization_id', orgId)
  }

  // Sync updated knowledge into this firm's Vapi assistant
  await syncKnowledgeBaseToVapi(orgId, db)

  const { data: updated } = await db.from('knowledge_documents').select('*').eq('id', docId).single()
  return NextResponse.json({ document: updated })
}

// Collects ALL documents for this org and pushes them into their Vapi assistant system prompt
// This is what ensures the AI always has the latest firm-specific information
async function syncKnowledgeBaseToVapi(orgId: string, db: any): Promise<void> {
  try {
    const { data: aiConfig } = await db
      .from('organization_ai_configs')
      .select('vapi_assistant_id')
      .eq('organization_id', orgId)
      .single()

    if (!aiConfig?.vapi_assistant_id) return

    const { data: org } = await db
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const { data: documents } = await db
      .from('knowledge_documents')
      .select('title, content_text')
      .eq('organization_id', orgId)
      .eq('is_processed', true)

    const { data: practiceAreas } = await db
      .from('practice_areas')
      .select('name')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    const firmName = org?.name || 'the firm'
    const practiceAreaNames = (practiceAreas || []).map((p: any) => p.name)

    // Build knowledge context from all this firm's documents only
    let knowledgeContext = ''
    if (documents && documents.length > 0) {
      knowledgeContext = documents
        .filter((d: any) => d.content_text && d.content_text.length > 10)
        .map((d: any) => `=== ${d.title} ===\n${d.content_text.slice(0, 3000)}`)
        .join('\n\n')
    }

    await updateVapiAssistantKnowledge(
      aiConfig.vapi_assistant_id,
      firmName,
      practiceAreaNames,
      knowledgeContext
    )

    console.log(`✅ Vapi assistant updated with knowledge for ${firmName}`)
  } catch (err: any) {
    // Non-fatal — document is still saved, Vapi sync can be retried
    console.error('Vapi knowledge sync failed:', err.message)
  }
}

async function processDocument(docId: string, orgId: string, kbId: string, contentText: string, db: any): Promise<void> {
  if (!contentText || contentText.length < 10) {
    await db.from('knowledge_documents').update({
      is_processed: true, chunk_count: 0, processed_at: new Date().toISOString()
    }).eq('id', docId)
    return
  }

  const words = contentText.split(/\s+/)
  const chunkSize = 500
  const overlap = 50
  let chunkIndex = 0

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim().length > 20) {
      await db.from('knowledge_chunks').insert({
        organization_id: orgId,
        document_id: docId,
        knowledge_base_id: kbId,
        content: chunk,
        chunk_index: chunkIndex++,
        metadata: {}
      })
    }
  }

  await db.from('knowledge_documents').update({
    is_processed: true,
    chunk_count: chunkIndex,
    processed_at: new Date().toISOString()
  }).eq('id', docId)
}
