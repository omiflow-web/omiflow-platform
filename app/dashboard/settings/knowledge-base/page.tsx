'use client'

import { useState, useEffect, useRef } from 'react'
import { BookOpen, FileText, Upload, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [kb, setKb] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocuments() }, [])

  async function loadDocuments() {
    const res = await fetch('/api/knowledge-base')
    const data = await res.json()
    setKb(data.knowledgeBase)
    setDocuments(data.documents || [])
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/knowledge-base', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()

    if (!res.ok) {
      setUploadError(data.error || 'Upload failed')
    } else {
      setUploadSuccess(`"${file.name}" uploaded and processing started`)
      setDocuments(prev => [data.document, ...prev])
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDocument(docId: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/knowledge-base?docId=${docId}`, { method: 'DELETE' })
    if (res.ok) setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  function StatusIcon({ doc }: { doc: any }) {
    if (doc.is_processed) return <CheckCircle className="w-4 h-4 text-green-500" />
    if (doc.processing_error) return <AlertCircle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
  }

  function fileSize(bytes: number) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Documents your AI receptionist uses to answer caller questions
        </p>
      </div>

      {/* KB info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-omiflow-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-omiflow-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{kb?.name || 'Main Knowledge Base'}</div>
            <div className="text-xs text-gray-400">{documents.length} document{documents.length !== 1 ? 's' : ''} · {documents.filter(d => d.is_processed).length} processed</div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Upload your fee schedules, service descriptions, FAQs, and policies. When a caller asks a question, the AI searches these documents and answers using your firm's own information — not generic responses.
        </p>
      </div>

      {/* Upload area */}
      <div
        className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-omiflow-300 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file && fileRef.current) {
            const dt = new DataTransfer()
            dt.items.add(file)
            fileRef.current.files = dt.files
            handleUpload({ target: fileRef.current } as any)
          }
        }}>
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleUpload} />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${uploading ? 'text-omiflow-500 animate-bounce' : 'text-gray-300'}`} />
        <div className="font-medium text-gray-700 text-sm mb-1">
          {uploading ? 'Uploading and processing...' : 'Upload a document'}
        </div>
        <p className="text-xs text-gray-400">
          PDF, Word (.docx), or plain text. Max 10MB. Drag and drop or click to browse.
        </p>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {uploadSuccess}
        </div>
      )}

      {/* What types of documents work well */}
      <div className="bg-omiflow-50 border border-omiflow-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-omiflow-900 mb-2">What to upload</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            '📋 Fee schedules and pricing',
            '📝 Service descriptions',
            '❓ Frequently asked questions',
            '📍 Office locations and hours',
            '📄 Process guides (how to apply)',
            '⚖️ Areas of law you cover',
            '🗓️ Consultation booking information',
            '📞 Contact information',
          ].map(item => (
            <div key={item} className="text-xs text-omiflow-800">{item}</div>
          ))}
        </div>
      </div>

      {/* Document list */}
      {!loading && documents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Uploaded Documents</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 p-4">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{doc.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {doc.file_name} · {fileSize(doc.file_size_bytes)} ·{' '}
                    {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIcon doc={doc} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    doc.is_processed ? 'bg-green-100 text-green-700' :
                    doc.processing_error ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {doc.is_processed ? 'Ready' : doc.processing_error ? 'Failed' : 'Processing'}
                  </span>
                  <button onClick={() => deleteDocument(doc.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && documents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <div className="text-gray-500 font-medium text-sm">No documents yet</div>
          <p className="text-gray-400 text-xs mt-1">Upload your first document above to get started</p>
        </div>
      )}
    </div>
  )
}
