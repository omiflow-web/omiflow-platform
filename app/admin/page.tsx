import { redirect } from 'next/navigation'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export default async function AdminPage() {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('is_omiflow_admin')
    .eq('id', user.id)
    .single()

  if (!userData?.is_omiflow_admin) redirect('/dashboard')

  const serviceClient = createServiceClient()

  const { data: orgs } = await serviceClient
    .from('organizations')
    .select('*, billing_subscriptions(*)')
    .order('created_at', { ascending: false })

  const totalOrgs = orgs?.length || 0
  const activeOrgs = orgs?.filter(o => o.is_active).length || 0
  const trialingOrgs = orgs?.filter(o => (o as any).billing_subscriptions?.status === 'trialing').length || 0

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
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
          <a href="/admin/organizations/new"
            className="bg-omiflow-600 hover:bg-omiflow-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Organization
          </a>
        </div>

        {/* Stats */}
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

        {/* Organizations Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
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
                {orgs?.map(org => {
                  const billing = (org as any).billing_subscriptions
                  return (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-gray-400 text-xs">{org.slug}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{org.industry?.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-gray-700">{billing?.plan || 'starter'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          org.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {billing?.status || (org.is_active ? 'active' : 'inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <a href={`/admin/organizations/${org.id}`}
                          className="text-omiflow-600 hover:underline text-xs font-medium">
                          Manage →
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!orgs || orgs.length === 0) && (
              <div className="p-12 text-center text-gray-400">
                No organizations yet. Create your first client.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
