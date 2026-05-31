import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { Users, Mail, Phone } from 'lucide-react'

export default async function StaffPage() {
  const supabase = createServerClientInstance(cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = (userData as any)?.organization_id

  const { data: staff } = await supabase
    .from('staff_members')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  const { data: roles } = await supabase.from('roles').select('*')

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your team members</p>
        </div>
        <button className="bg-omiflow-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-omiflow-700 transition-colors">
          + Add Staff Member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {staff && staff.length > 0 ? staff.map(member => (
          <div key={member.id} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-omiflow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-omiflow-700 text-sm font-semibold">
                {member.first_name[0]}{member.last_name[0]}
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
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
              <button className="text-xs text-omiflow-600 hover:underline">Edit</button>
            </div>
          </div>
        )) : (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium text-sm">No staff members yet</div>
          </div>
        )}
      </div>
    </div>
  )
}
