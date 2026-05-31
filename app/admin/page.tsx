'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const res = await fetch('/api/admin/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrgs(data.organizations || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const totalOrgs = orgs.length
  const activeOrgs = orgs.filter(o => o.is_active).length
  const trialingOrgs = orgs.filter(o => o.billing_subscriptions?.status === 'trialing').length

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-omiflow-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="font-bold text-gray-900">Omiflow Admin</span>
            </div>
            <p className="text-sm text-gray-500">Platform administration</p>
          </div>
          <div className="flex gap-3">
            <a href="/admin/organizations/new"
              className="bg-omiflow-600 hover:bg-omiflow-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              + New Organization
            </a>
            <button onClick={handleLogout}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Log out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Organizations', value: totalOrgs },
            { label: 'Active', value: activeOrgs },
            { label: 'On Trial', value: trialingOrgs }
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Firm</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Industry</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Plan</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Created</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orgs.map((org: any) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-gray-400 text-xs">{org.slug}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{org.industry?.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4 capitalize text-gray-700">{org.billing_subscriptions?.plan || 'starter'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {org.billing_subscriptions?.status || (org.is_active ? 'active' : 'inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{new Date(org.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <a href={`/admin/organizations/${org.id}`} className="text-omiflow-600 hover:underline text-xs font-medium">Manage →</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && orgs.length === 0 && (
              <div className="p-12 text-center text-gray-400">No organizations yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
