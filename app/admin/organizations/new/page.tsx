'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<any>(null)

  const [form, setForm] = useState({
    name: '',
    industry: 'immigration_law',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPhone: '',
    phoneNumber: ''
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
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

    setSuccess(data)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-md w-full">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Organization Created</h2>
          <p className="text-gray-500 text-sm mb-6">{success.organization.name} is now live on Omiflow.</p>

          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Login URL</span>
              <span className="font-medium">{process.env.NEXT_PUBLIC_APP_URL}/auth/login</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{form.ownerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Temp Password</span>
              <span className="font-mono font-medium">{success.tempPassword}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-6">A welcome email has been sent with these credentials.</p>

          <div className="flex gap-3">
            <button onClick={() => router.push('/admin')}
              className="flex-1 bg-omiflow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-omiflow-700">
              Back to Admin
            </button>
            <button onClick={() => { setSuccess(null); setForm({ name: '', industry: 'immigration_law', ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerPhone: '', phoneNumber: '' }) }}
              className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Create Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Admin</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">New Organization</h1>
          <p className="text-gray-500 text-sm">Onboard a new client firm to Omiflow</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Firm Details */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Firm Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name *</label>
              <input value={form.name} onChange={e => update('name', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                placeholder="Morrison Immigration Law" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select value={form.industry} onChange={e => update('industry', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
                <option value="immigration_law">Immigration Law</option>
                <option value="family_law">Family Law</option>
                <option value="personal_injury">Personal Injury</option>
                <option value="conveyancing">Conveyancing</option>
                <option value="general_law">General Law</option>
                <option value="accounting">Accounting</option>
                <option value="healthcare">Healthcare</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Phone Number</label>
              <input value={form.phoneNumber} onChange={e => update('phoneNumber', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                placeholder="+12125550101" />
              <p className="text-xs text-gray-400 mt-1">The Twilio number assigned to this client</p>
            </div>
          </div>

          {/* Owner Details */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Firm Owner</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input value={form.ownerFirstName} onChange={e => update('ownerFirstName', e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input value={form.ownerLastName} onChange={e => update('ownerLastName', e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.ownerEmail} onChange={e => update('ownerEmail', e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                placeholder="owner@firm.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (for call forwarding)</label>
              <input value={form.ownerPhone} onChange={e => update('ownerPhone', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
                placeholder="+12125550199" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-omiflow-600 hover:bg-omiflow-700 text-white font-medium py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Creating organization...' : 'Create Organization & Send Welcome Email'}
          </button>
        </form>
      </div>
    </div>
  )
}
