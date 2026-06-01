'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BookOpen, FileText, Upload, Trash2, CheckCircle, Clock, AlertCircle, Edit2, Save, X, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function EditDocumentModal({ doc, onClose, onSaved }: { doc: any; onClose: () => void; onSaved: (doc: any) => void }) {
  const [title, setTitle] = useState(doc.title)
  const [content, setContent] = useState(doc.content_text || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/knowledge-base?docId=${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content_text: content })
    })
    if (res.ok) {
      const data = await res.json()
      onSaved(data.document)
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit Document</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <p className="text-xs text-gray-400 mb-2">This is the text the AI will use to answer caller questions. Edit, correct, or add to it as needed.</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={16}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500 font-mono resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-omiflow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-omiflow-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [kb, setKb] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [editingDoc, setEditingDoc] = useState<any>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<any>(null)

  const loadDocuments = useCallback(async () => {
    const res = await fetch('/api/knowledge-base')
    const data = await res.json()
    setKb(data.knowledgeBase)
    setDocuments(data.documents || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDocuments()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadDocuments])

  // Poll for processing updates
  function startPolling() {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const res = await fetch('/api/knowledge-base')
      const data = await res.json()
      const docs = data.documents || []
      setDocuments(docs)
      // Stop polling once all are processed
      const allDone = docs.every((d: any) => d.is_processed || d.processing_error)
      if (allDone) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 2000)
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/knowledge-base', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setUploadError(data.error || 'Upload failed')
    } else {
      setUploadSuccess(`"${file.name}" uploaded successfully`)
      setDocuments(prev => [data.document, ...prev])
      startPolling()
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDocument(docId: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/knowledge-base?docId=${docId}`, { method: 'DELETE' })
    if (res.ok) setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  function fileSize(bytes: number) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const suggestions = [
    '📋 Fee schedules and pricing',
    '📝 What your business does and who you help',
    '❓ Frequently asked questions',
    '📍 Office locations and hours',
    '📄 How your process works step by step',
    '⚖️ Services and specialisms you offer',
    '🗓️ How to book a consultation',
    '📞 Contact details and best way to reach you',
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {editingDoc && (
        <EditDocumentModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSaved={updated => setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-0.5">Documents your AI receptionist uses to answer caller questions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-omiflow-100 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-omiflow-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{kb?.name || 'Main Knowledge Base'}</div>
            <div className="text-xs text-gray-400">
              {documents.length} document{documents.length !== 1 ? 's' : ''} · {documents.filter(d => d.is_processed).length} ready
            </div>
          </div>
          <button onClick={loadDocuments} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Upload your documents below. After uploading you can review and edit the extracted text before it goes into the AI — making sure it's accurate and complete.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`bg-white rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-omiflow-400 bg-omiflow-50' : 'border-gray-200 hover:border-omiflow-300'
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFileUpload(file)
        }}>
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${uploading ? 'text-omiflow-500 animate-bounce' : dragging ? 'text-omiflow-500' : 'text-gray-300'}`} />
        <div className="font-medium text-gray-700 text-sm mb-1">
          {uploading ? 'Uploading and processing...' : dragging ? 'Drop to upload' : 'Upload a document'}
        </div>
        <p className="text-xs text-gray-400">PDF, Word (.docx), or plain text · Max 10MB · Drag and drop or click to browse</p>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{uploadError}</div>
      )}
      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {uploadSuccess} — you can now review and edit the extracted content below.
        </div>
      )}

      {/* Suggestions */}
      <div className="bg-omiflow-50 border border-omiflow-100 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-omiflow-900 mb-2">What to upload</h3>
        <div className="grid grid-cols-2 gap-2">
          {suggestions.map(item => (
            <div key={item} className="text-xs text-omiflow-800">{item}</div>
          ))}
        </div>
      </div>

      {/* Document list */}
      {!loading && documents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Uploaded Documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click the edit button to review and correct the extracted text before it goes into the AI</p>
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
                    {doc.file_name} · {fileSize(doc.file_size_bytes)} · {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!doc.is_processed && !doc.processing_error && (
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Processing...
                    </span>
                  )}
                  {doc.is_processed && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Ready
                    </span>
                  )}
                  {doc.processing_error && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Failed</span>
                  )}
                  <button
                    onClick={() => setEditingDoc(doc)}
                    className="p-1.5 text-gray-400 hover:text-omiflow-600 hover:bg-omiflow-50 rounded-lg transition-colors"
                    title="Review and edit content">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id)}
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
