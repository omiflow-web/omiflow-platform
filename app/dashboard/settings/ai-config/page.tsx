'use client'

import { useState, useEffect } from 'react'
import { Bot, Save, Check } from 'lucide-react'

export default function AIConfigPage() {
  const [aiConfig, setAiConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setAiConfig(d.aiConfig)
      setLoading(false)
    })
  }, [])

  async function saveAIConfig() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ai_config', data: aiConfig })
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError('Failed to save — please try again')
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure your AI receptionist's voice, behaviour, and what it collects from callers
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <Check className="w-4 h-4" /> Changes saved and synced to your AI receptionist
        </div>
      )}

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{aiConfig?.assistant_name || 'AI Receptionist'}</div>
            <div className={`text-xs font-medium flex items-center gap-1 ${aiConfig?.vapi_assistant_id ? 'text-green-600' : 'text-yellow-600'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
              {aiConfig?.vapi_assistant_id ? 'Connected and active' : 'Not yet connected'}
            </div>
          </div>
        </div>
      </div>

      {/* Voice and personality */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Voice and Personality</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Name</label>
          <input
            value={aiConfig?.assistant_name || ''}
            onChange={e => setAiConfig((p: any) => ({ ...p, assistant_name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
            placeholder="AI Receptionist" />
          <p className="text-xs text-gray-400 mt-1">Internal name for this assistant</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
          <input
            value={aiConfig?.greeting_message || ''}
            onChange={e => setAiConfig((p: any) => ({ ...p, greeting_message: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
            placeholder="Thank you for calling. I'm the virtual assistant — how can I help?" />
          <p className="text-xs text-gray-400 mt-1">First thing the AI says when a caller connects</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
          <select
            value={aiConfig?.voice_id || 'jennifer'}
            onChange={e => setAiConfig((p: any) => ({ ...p, voice_id: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
            <option value="jennifer">Jennifer (Female, US)</option>
            <option value="rachel">Rachel (Female, US)</option>
            <option value="adam">Adam (Male, US)</option>
            <option value="josh">Josh (Male, US)</option>
            <option value="bella">Bella (Female, UK)</option>
            <option value="charlie">Charlie (Male, UK)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Call Duration</label>
          <select
            value={aiConfig?.max_call_duration_seconds || 600}
            onChange={e => setAiConfig((p: any) => ({ ...p, max_call_duration_seconds: parseInt(e.target.value) }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1200}>20 minutes</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">AI will end the call after this duration</p>
        </div>
      </div>

      {/* What the AI collects */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">What the AI Collects</h2>
        <p className="text-sm text-gray-500">What information should the AI gather from every caller?</p>

        {[
          { label: 'Caller name', key: 'collect_name', desc: 'Ask for and record the caller\'s full name' },
          { label: 'Callback number', key: 'collect_callback_number', desc: 'Confirm a number to call back on' },
          { label: 'Reason for calling', key: 'collect_reason', desc: 'Ask what they\'re calling about' },
          { label: 'Book appointments', key: 'book_appointments', desc: 'Allow the AI to book consultations directly' },
          { label: 'Use knowledge base', key: 'use_knowledge_base', desc: 'Answer questions from your uploaded documents' },
        ].map(field => (
          <div key={field.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <div className="text-sm font-medium text-gray-700">{field.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{field.desc}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiConfig?.[field.key] ?? true}
                onChange={e => setAiConfig((p: any) => ({ ...p, [field.key]: e.target.checked }))}
                className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-omiflow-600" />
            </label>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <strong>Automation rules</strong> (callback promise timing, escalation thresholds, SMS templates) are managed in the{' '}
        <a href="/dashboard/settings/automation" className="text-omiflow-600 hover:underline font-medium">Automation</a> settings.
      </div>

      <button
        onClick={saveAIConfig}
        disabled={saving}
        className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-omiflow-700 disabled:opacity-50 transition-colors">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save & Sync to AI'}
      </button>
    </div>
  )
}
