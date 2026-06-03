'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader } from 'lucide-react'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', slug: '', industry: 'immigration_law',
    ownerEmail: '', ownerFirstName: '', ownerLastName: '', ownerPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      setLoading(false)
      return
    }

    setResult(data)
    setLoading(false)
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-4">{result.organization.name} created</h2>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
            <div><span className="text-gray-500">Org ID:</span> <span className="font-mono text-xs">{result.organization.id}</span></div>
            <div>
              <span className="text-gray-500">Vapi Assistant:</span>{' '}
              {result.vapiAssistantId ? (
                <span className="font-mono text-xs text-green-700">{result.vapiAssistantId}</span>
              ) : (
                <span className="text-red-600 text-xs">Failed to create — add manually in Vapi</span>
              )}
            </div>
            {result.ownerUser && (
              <>
                <div><span className="text-gray-500">Login email:</span> <span className="font-medium">{result.ownerUser.email}</span></div>
                <div><span className="text-gray-500">Password:</span> <span className="font-mono">{result.ownerUser.password}</span></div>
              </>
            )}
          </div>

          <div className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            Save the login credentials above — the password won't be shown again.
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push(`/admin/organizations/${result.organization.id}`)}
              className="flex-1 bg-omiflow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-omiflow-700">
              Open Org →
            </button>
            <button onClick={() => router.push('/admin')}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Back to Admin
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-lg mx-auto">
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Admin</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">Create New Organisation</h1>
        <p className="text-sm text-gray-500 mb-6">
          This will create the firm's account, their own Vapi assistant, and their dashboard login.
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Firm Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name *</label>
            <input value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))}
              required placeholder="Morrison Immigration Law"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input value={form.slug}
              onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
              required placeholder="morrison-immigration-law"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            <p className="text-xs text-gray-400 mt-1">Auto-generated from name. Used in the dashboard URL.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
              <option value="immigration_law">Immigration Law</option>
              <option value="family_law">Family Law</option>
              <option value="personal_injury">Personal Injury</option>
              <option value="criminal_defence">Criminal Defence</option>
              <option value="employment_law">Employment Law</option>
              <option value="general_legal">General Legal</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 mt-4">
          <h2 className="font-semibold text-gray-900 text-sm">Owner Account <span className="text-gray-400 font-normal">(optional)</span></h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input value={form.ownerFirstName} onChange={e => setForm(p => ({ ...p, ownerFirstName: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input value={form.ownerLastName} onChange={e => setForm(p => ({ ...p, ownerLastName: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.ownerEmail} onChange={e => setForm(p => ({ ...p, ownerEmail: e.target.value }))}
              placeholder="owner@firm.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="text" value={form.ownerPassword} onChange={e => setForm(p => ({ ...p, ownerPassword: e.target.value }))}
              placeholder="Leave blank to auto-generate"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
          </div>
        </div>

        <div className="bg-omiflow-50 border border-omiflow-100 rounded-xl p-4 mt-4 text-sm text-omiflow-800">
          Creating this organisation will automatically create a dedicated Vapi assistant for this firm using your template assistant as the base. The firm's name will be injected into the greeting and system prompt.
        </div>

        <button onClick={handleSubmit} disabled={loading || !form.name || !form.slug}
          className="w-full mt-4 bg-omiflow-600 text-white font-medium py-3 rounded-xl text-sm hover:bg-omiflow-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader className="w-4 h-4 animate-spin" />Creating organisation and Vapi assistant...</> : 'Create Organisation'}
        </button>
      </div>
    </div>
  )
}
