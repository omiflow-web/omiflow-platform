'use client'

import { useState, useEffect } from 'react'
import { Users, Mail, Phone, Plus, X, Check } from 'lucide-react'

function AddStaffModal({ onClose, onAdded }: { onClose: () => void; onAdded: (staff: any) => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'receptionist' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<any>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/staff', {
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
    onAdded(data.staff)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Staff Member Added</h3>
          {success.tempPassword && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm mb-4">
              <div className="text-gray-500 mb-1">Login credentials:</div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{form.email}</span></div>
              <div><span className="text-gray-500">Temp Password:</span> <span className="font-mono font-medium">{success.tempPassword}</span></div>
              <div className="text-xs text-gray-400 mt-2">Share these with the staff member — they should change their password on first login.</div>
            </div>
          )}
          <button onClick={onClose} className="w-full bg-omiflow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-omiflow-700">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Add Staff Member</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
              placeholder="+447911123456" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="solicitor">Solicitor</option>
              <option value="receptionist">Receptionist</option>
              <option value="administrator">Administrator</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-omiflow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-omiflow-700 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch('/api/staff').then(r => r.json()).then(d => {
      setStaff(d.staff || [])
      setLoading(false)
    })
  }, [])

  async function toggleActive(staffId: string, currentStatus: boolean) {
    await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, is_active: !currentStatus })
    })
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, is_active: !currentStatus } : s))
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {showModal && (
        <AddStaffModal
          onClose={() => setShowModal(false)}
          onAdded={newStaff => setStaff(prev => [...prev, newStaff])}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your team and their portal access</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-omiflow-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : staff.length > 0 ? staff.map(member => (
          <div key={member.id} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-omiflow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-omiflow-700 text-sm font-semibold">
                {member.first_name?.[0]}{member.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm">{member.first_name} {member.last_name}</div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />{member.email}
                </span>
                {member.phone && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" />{member.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => toggleActive(member.id, member.is_active)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                {member.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        )) : (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium text-sm">No staff members yet</div>
            <p className="text-xs text-gray-400 mt-1">Add your first team member above</p>
          </div>
        )}
      </div>
    </div>
  )
}
