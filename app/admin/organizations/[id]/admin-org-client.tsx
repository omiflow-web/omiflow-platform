'use client'

import { useState, useRef } from 'react'
import { Building2, Phone, Bot, Users, FileText, BarChart3, Settings, Eye, Upload, CheckCircle, Trash2, Save, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Tab = 'overview' | 'ai' | 'staff' | 'knowledge' | 'settings' | 'calls' | 'leads'

export default function AdminOrgClient({ org, billing, staff, phones, aiConfig, settings, practiceAreas, documents, callCount, leadCount }: any) {
  const [tab, setTab] = useState<Tab>('overview')
  const [saved, setSaved] = useState(false)
  const [localAI, setLocalAI] = useState(aiConfig || {})
  const [localSettings, setLocalSettings] = useState(settings || {})
  const [localDocuments, setLocalDocuments] = useState(documents)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function saveAI() {
    await fetch(`/api/admin/orgs/${org.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ai_config', data: localAI })
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveSettings() {
    await fetch(`/api/admin/orgs/${org.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', data: localSettings })
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadMsg('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('orgId', org.id)
    const res = await fetch('/api/admin/knowledge-base', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok) {
      setLocalDocuments((prev: any[]) => [data.document, ...prev])
      setUploadMsg(`"${file.name}" uploaded successfully`)
    } else {
      setUploadMsg(data.error || 'Upload failed')
    }
    setUploading(false)
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/admin/knowledge-base?docId=${docId}&orgId=${org.id}`, { method: 'DELETE' })
    setLocalDocuments((prev: any[]) => prev.filter((d: any) => d.id !== docId))
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'ai', label: 'AI Config', icon: Bot },
    { key: 'staff', label: 'Staff', icon: Users },
    { key: 'knowledge', label: 'Knowledge Base', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Admin</a>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{org.name}</h1>
            <p className="text-sm text-gray-500">{org.slug} · Created {new Date(org.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/admin/organizations/${org.id}/view-as`}
              className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-omiflow-700 transition-colors">
              <Eye className="w-4 h-4" /> View As Client
            </a>
          </div>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <Check className="w-4 h-4" /> Saved successfully
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Calls', value: callCount },
            { label: 'Total Leads', value: leadCount },
            { label: 'Staff Members', value: staff.length },
            { label: 'Plan', value: billing?.plan || 'starter' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-xl font-bold text-gray-900 capitalize">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t.key ? 'border-omiflow-600 text-omiflow-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Industry</div>
                    <div className="text-sm font-medium text-gray-900 capitalize">{org.industry?.replace(/_/g, ' ')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Status</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {billing?.status || (org.is_active ? 'active' : 'inactive')}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Twilio Number</div>
                    <div className="text-sm font-medium text-gray-900">{phones[0]?.number || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Vapi Assistant</div>
                    <div className="text-sm font-medium text-gray-900">
                      {aiConfig?.vapi_assistant_id ? aiConfig.vapi_assistant_id.slice(0, 20) + '...' : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Notification Email</div>
                    <div className="text-sm font-medium text-gray-900">{settings?.notification_email || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Practice Areas</div>
                    <div className="text-sm font-medium text-gray-900">{practiceAreas.length} configured</div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Config */}
            {tab === 'ai' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Name</label>
                  <input value={localAI.assistant_name || ''} onChange={e => setLocalAI((p: any) => ({ ...p, assistant_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
                  <input value={localAI.greeting_message || ''} onChange={e => setLocalAI((p: any) => ({ ...p, greeting_message: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                    placeholder="Thank you for calling. How can I help?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
                  <select value={localAI.voice_id || 'jennifer'} onChange={e => setLocalAI((p: any) => ({ ...p, voice_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
                    <option value="jennifer">Jennifer (Female, US)</option>
                    <option value="rachel">Rachel (Female, US)</option>
                    <option value="bella">Bella (Female, UK)</option>
                    <option value="adam">Adam (Male, US)</option>
                    <option value="charlie">Charlie (Male, UK)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vapi Assistant ID</label>
                  <input value={localAI.vapi_assistant_id || ''} onChange={e => setLocalAI((p: any) => ({ ...p, vapi_assistant_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500 font-mono"
                    placeholder="ab8e47dc-..." />
                </div>
                <button onClick={saveAI} className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-omiflow-700">
                  <Save className="w-4 h-4" /> Save AI Config
                </button>
              </div>
            )}

            {/* Staff */}
            {tab === 'staff' && (
              <div className="space-y-3">
                {staff.length > 0 ? staff.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-omiflow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-omiflow-700 text-xs font-semibold">{member.first_name?.[0]}{member.last_name?.[0]}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</div>
                      <div className="text-xs text-gray-400">{member.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )) : <p className="text-sm text-gray-400">No staff members yet</p>}
              </div>
            )}

            {/* Knowledge Base */}
            {tab === 'knowledge' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-omiflow-300 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                  <Upload className={`w-6 h-6 mx-auto mb-2 ${uploading ? 'text-omiflow-500 animate-bounce' : 'text-gray-300'}`} />
                  <div className="text-sm font-medium text-gray-700">{uploading ? 'Uploading...' : 'Upload document for this firm'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">PDF, Word, or plain text</div>
                </div>
                {uploadMsg && (
                  <div className={`text-sm rounded-lg px-4 py-3 ${uploadMsg.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {uploadMsg}
                  </div>
                )}
                <div className="space-y-2">
                  {localDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{doc.title}</div>
                        <div className="text-xs text-gray-400">{doc.file_name} · {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.is_processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {doc.is_processed ? 'Ready' : 'Processing'}
                      </span>
                      <button onClick={() => deleteDoc(doc.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {localDocuments.length === 0 && <p className="text-sm text-gray-400">No documents uploaded yet</p>}
                </div>
              </div>
            )}

            {/* Settings */}
            {tab === 'settings' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notification Email</label>
                  <input value={localSettings.notification_email || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, notification_email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                    placeholder="manager@firm.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager SMS Number</label>
                  <input value={localSettings.notification_phone || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, notification_phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                    placeholder="+447911123456" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Callback Promise (hours)</label>
                    <input type="number" value={localSettings.callback_promise_hours || 2}
                      onChange={e => setLocalSettings((p: any) => ({ ...p, callback_promise_hours: parseInt(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Escalation (hours)</label>
                    <input type="number" value={localSettings.escalation_hours || 24}
                      onChange={e => setLocalSettings((p: any) => ({ ...p, escalation_hours: parseInt(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
                  </div>
                </div>
                <button onClick={saveSettings} className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-omiflow-700">
                  <Save className="w-4 h-4" /> Save Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
