import { redirect } from 'next/navigation'
import { createServerClientInstance } from '@/lib/supabase-server'
import DashboardSidebar from '@/components/dashboard/sidebar'
import DashboardHeader from '@/components/dashboard/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/auth/login')

  // Redirect admins to admin portal
  if (userData.is_omiflow_admin && !userData.organization_id) {
    redirect('/admin')
  }

  const org = (userData as any).organizations

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar user={userData} org={org} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={userData} org={org} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
