import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClientInstance } from '@/lib/supabase'
import DashboardSidebar from '@/components/dashboard/sidebar'
import DashboardHeader from '@/components/dashboard/header'
import MobileNav from '@/components/dashboard/mobile-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/auth/login')
  if ((userData as any).is_omiflow_admin && !(userData as any).organization_id) redirect('/admin')
  if (!(userData as any).organization_id) redirect('/auth/login')

  const org = (userData as any).organizations

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop layout */}
      <div className="hidden md:flex h-screen">
        <DashboardSidebar user={userData} org={org} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader user={userData} org={org} />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Mobile header */}
        <MobileHeader user={userData} org={org} />
        <main className="flex-1 pb-20">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  )
}

function MobileHeader({ user, org }: { user: any; org: any }) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-omiflow-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">O</span>
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-sm leading-tight">Omiflow</div>
          <div className="text-gray-400 text-[10px] leading-tight truncate max-w-[140px]">{org?.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          AI Active
        </div>
        <MobileNotifButton />
      </div>
    </header>
  )
}

function MobileNotifButton() {
  return (
    <div className="relative w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
    </div>
  )
}
