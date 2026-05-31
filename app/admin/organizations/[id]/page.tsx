import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'

export default async function AdminOrgDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRow } = await supabase.from('users').select('is_omiflow_admin').eq('id', user.id).single()
  if (!(userRow as any)?.is_omiflow_admin) redirect('/dashboard')

  const db = createServiceClient() as any

  const { data: org } = await db
    .from('organizations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!org) notFound()

  const { data: billing } = await db.from('billing_subscriptions').select('*').eq('organization_id', params.id).single()
  const { data: staff } = await db.from('staff_members').select('*').eq('organization_id', params.id).order('created_at', { ascending: true })
  const { data: phoneNumbers } = await db.from('phone_numbers').select('*').eq('organization_id', params.id)
  const { data: aiConfig } = await db.from('organization_ai_configs').select('*').eq('organization_id', params.id).single()
  const { data: settings } = await db.from('organization_settings').select('*').eq('organization_id', params.id).single()

  const callCount = await db.from('calls').select('id', { count: 'exact', head: true }).eq('organization_id', params.id)
  const leadCount = await db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', params.id)

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
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {org.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 capitalize">
              {billing?.plan || 'starter'} · {billing?.status || 'trialing'}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="lg:col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Calls', value: callCount.count || 0 },
              { label: 'Total Leads', value: leadCount.count || 0 },
              { label: 'Staff Members', value: staff?.length || 0 },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Org Details */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Organization Details</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Industry', value: org.industry?.replace(/_/g, ' ') },
                { label: 'Timezone', value: org.timezone },
                { label: 'Country', value: org.country },
                { label: 'Onboarded', value: org.is_onboarded ? 'Yes' : 'No' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900 capitalize">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Config */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">AI Configuration</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Assistant ID', value: aiConfig?.vapi_assistant_id ? aiConfig.vapi_assistant_id.slice(0, 16) + '...' : 'Not set' },
                { label: 'Voice', value: aiConfig?.voice_id || 'jennifer' },
                { label: 'Max Duration', value: aiConfig?.max_call_duration_seconds ? `${aiConfig.max_call_duration_seconds / 60}min` : '10min' },
                { label: 'Knowledge Base', value: aiConfig?.use_knowledge_base ? 'Enabled' : 'Disabled' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Phone Numbers</h2>
            {phoneNumbers && phoneNumbers.length > 0 ? (
              <div className="space-y-3">
                {phoneNumbers.map((p: any) => (
                  <div key={p.id} className="text-sm">
                    <div className="font-medium text-gray-900">{p.number}</div>
                    <div className="text-gray-400 text-xs">Forwards to: {p.forward_to || 'Not set'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No phone numbers</p>
            )}
          </div>

          {/* Automation Settings */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Automation Settings</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Callback Promise', value: `${settings?.callback_promise_hours || 2} hours` },
                { label: 'Escalation After', value: `${settings?.escalation_hours || 24} hours` },
                { label: 'Auto SMS', value: settings?.auto_sms_enabled ? 'On' : 'Off' },
                { label: 'Auto Email', value: settings?.auto_email_enabled ? 'On' : 'Off' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Staff */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Staff Members</h2>
            {staff && staff.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {staff.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 bg-omiflow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-omiflow-700 text-xs font-semibold">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</div>
                      <div className="text-xs text-gray-400">{member.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No staff members</p>
            )}
          </div>
        </div>

        {/* Notification settings */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Notification Recipients</h2>
          <div className="text-sm text-gray-600">
            {settings?.email_summary_recipients?.length > 0
              ? settings.email_summary_recipients.join(', ')
              : 'None configured'}
          </div>
        </div>
      </div>
    </div>
  )
}
