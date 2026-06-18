'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewOpportunityPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_name: '', phone: '', email: '',
    enquiry_type: '', priority: 'medium', source: 'manual', notes: '',
    next_action_note: '', next_action_date: ''
  })

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function submit() {
    if (!form.first_name && !form.company_name && !form.phone) {
      setError('Add at least a name, company, or phone number')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        next_action_date: form.next_action_date ? new Date(form.next_action_date).toISOString() : null
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Something went wrong'); return }
    router.push(`/dashboard/opportunities/${data.id}`)
  }

  const field = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
  const label = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 md:px-0 pb-24 md:pb-6">
      <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700">← Back to dashboard</Link>
      <h1 className="text-xl font-bold text-gray-900 mt-3 mb-1">New Opportunity</h1>
      <p className="text-xs text-gray-500 mb-6">Add an enquiry that came in by phone, email, or in person.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>First name</label><input className={field} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
          <div><label className={label}>Last name</label><input className={field} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
        </div>
        <div><label className={label}>Company</label><input className={field} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Phone</label><input className={field} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className={label}>Email</label><input className={field} value={form.email} onChange={e => set('email', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Enquiry type</label><input className={field} placeholder="e.g. Skilled Worker Visa" value={form.enquiry_type} onChange={e => set('enquiry_type', e.target.value)} /></div>
          <div>
            <label className={label}>Priority</label>
            <select className={field} value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Source</label>
          <select className={field} value={form.source} onChange={e => set('source', e.target.value)}>
            <option value="manual">Manual entry</option><option value="phone">Phone call</option>
            <option value="website">Website form</option><option value="email">Email</option><option value="referral">Referral</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Next action — when</label><input type="datetime-local" className={field} value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} /></div>
          <div><label className={label}>Next action — what</label><input className={field} placeholder="e.g. Call back" value={form.next_action_note} onChange={e => set('next_action_note', e.target.value)} /></div>
        </div>
        <div><label className={label}>Notes</label><textarea rows={3} className={`${field} resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>

        <button onClick={submit} disabled={saving}
          className="w-full bg-indigo-600 text-white font-medium py-3 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? 'Creating…' : 'Create Opportunity'}
        </button>
      </div>
    </div>
  )
}
