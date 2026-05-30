import { createServerClientInstance } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { BookOpen, FileText, Upload } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function KnowledgeBasePage() {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  const { data: kb } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('organization_id', orgId)
    .single()

  const { data: documents } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-0.5">Documents your AI receptionist uses to answer questions</p>
      </div>

      {/* KB info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-omiflow-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-omiflow-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{kb?.name || 'Main Knowledge Base'}</div>
            <div className="text-xs text-gray-400">{documents?.length || 0} documents</div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Upload documents, FAQs, fee schedules, and firm policies. Your AI receptionist will reference these when answering caller questions.
        </p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <div className="font-medium text-gray-700 text-sm mb-1">Upload Documents</div>
        <p className="text-xs text-gray-400 mb-4">PDF, Word, or plain text files. Max 10MB each.</p>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2 inline-block">
          Document upload requires Phase 5 (RAG / Knowledge Base). Coming soon.
        </p>
      </div>

      {/* Document list */}
      {documents && documents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Uploaded Documents</h2>
          </div>
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 p-4">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{doc.title}</div>
                <div className="text-xs text-gray-400">
                  {doc.file_name} · {doc.chunk_count} chunks ·{' '}
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                doc.is_processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {doc.is_processed ? 'Processed' : 'Processing...'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
