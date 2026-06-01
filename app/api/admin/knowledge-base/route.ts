import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const orgId = formData.get('orgId') as string
  if (!file || !orgId) return NextResponse.json({ error: 'Missing file or orgId' }, { status: 400 })

  const db = createServiceClient() as any
  const { data: kb } = await db.from('knowledge_bases').select('id').eq('organization_id', orgId).single()
  if (!kb) return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  let contentText = ext === '.txt' || ext === '.md' ? buffer.toString('utf-8') : `[${file.name}] — Document uploaded by admin`

  const { data: doc } = await db.from('knowledge_documents').insert({
    organization_id: orgId,
    knowledge_base_id: kb.id,
    title: file.name.replace(/\.[^/.]+$/, ''),
    file_name: file.name,
    file_type: ext,
    file_size_bytes: file.size,
    content_text: contentText,
    uploaded_by: user.id,
    is_processed: false
  }).select().single()

  // Process chunks
  if (contentText && contentText.length > 10) {
    const words = contentText.split(/\s+/)
    const chunkSize = 500
    let idx = 0
    for (let i = 0; i < words.length; i += 450) {
      const chunk = words.slice(i, i + chunkSize).join(' ')
      if (chunk.trim().length > 20) {
        await db.from('knowledge_chunks').insert({ organization_id: orgId, document_id: doc.id, knowledge_base_id: kb.id, content: chunk, chunk_index: idx++, metadata: {} })
      }
    }
    await db.from('knowledge_documents').update({ is_processed: true, chunk_count: idx, processed_at: new Date().toISOString() }).eq('id', doc.id)
  }

  const { data: updated } = await db.from('knowledge_documents').select('*').eq('id', doc.id).single()
  return NextResponse.json({ document: updated })
}

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')
  const orgId = searchParams.get('orgId')
  if (!docId || !orgId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const db = createServiceClient() as any
  await db.from('knowledge_chunks').delete().eq('document_id', docId)
  await db.from('knowledge_documents').delete().eq('id', docId).eq('organization_id', orgId)

  return NextResponse.json({ success: true })
}
