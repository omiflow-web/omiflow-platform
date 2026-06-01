import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

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

async function extractText(buffer: Buffer, ext: string, fileName: string): Promise<string> {
  try {
    if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8')
    }

    if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    }

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text || ''
    }

    return `[${fileName}] — Unsupported file type`
  } catch (err: any) {
    console.error(`Text extraction failed for ${fileName}:`, err.message)
    return `[${fileName}] — Text extraction failed: ${err.message}`
  }
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
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
  }

  const db = createServiceClient() as any
  const { data: kb } = await db.from('knowledge_bases').select('id').eq('organization_id', orgId).single()
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Extract real text content
  const contentText = await extractText(buffer, ext, file.name)

  // Upload to storage
  const storagePath = `${orgId}/${Date.now()}-${file.name}`
  await supabase.storage.from('knowledge-documents').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream'
  })

  // Create document record
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

  // Chunk and index
  await processDocument(doc.id, orgId, kb.id, contentText, db)

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
    if (doc) {
      await processDocument(docId, orgId, doc.knowledge_base_id, content_text, db)
    }
    await db.from('knowledge_documents').update({
      title: title || undefined,
      content_text,
      updated_at: new Date().toISOString()
    }).eq('id', docId).eq('organization_id', orgId)
  } else if (title) {
    await db.from('knowledge_documents').update({ title }).eq('id', docId).eq('organization_id', orgId)
  }

  const { data: updated } = await db.from('knowledge_documents').select('*').eq('id', docId).single()
  return NextResponse.json({ document: updated })
}

async function processDocument(docId: string, orgId: string, kbId: string, contentText: string, db: any): Promise<void> {
  if (!contentText || contentText.length < 10) return

  const words = contentText.split(/\s+/)
  const chunkSize = 500
  const overlap = 50
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim().length > 20) chunks.push(chunk)
  }

  for (let i = 0; i < chunks.length; i++) {
    await db.from('knowledge_chunks').insert({
      organization_id: orgId,
      document_id: docId,
      knowledge_base_id: kbId,
      content: chunks[i],
      chunk_index: i,
      metadata: { chunkTotal: chunks.length }
    })
  }

  await db.from('knowledge_documents').update({
    is_processed: true,
    chunk_count: chunks.length,
    processed_at: new Date().toISOString()
  }).eq('id', docId)

  console.log(`✅ Processed ${docId}: ${chunks.length} chunks`)
}
