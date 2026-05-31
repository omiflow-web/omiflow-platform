'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Phone, Users, MessageSquare,
  Calendar, CheckSquare, BarChart3, Settings,
  BookOpen, LogOut, Bot, Zap, CreditCard
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/communications', label: 'Communications', icon: MessageSquare },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
]

const settingsItems = [
  { href: '/dashboard/settings/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/dashboard/settings/staff', label: 'Staff', icon: Users },
  { href: '/dashboard/settings/ai-config', label: 'AI Config', icon: Bot },
  { href: '/dashboard/settings/automation', label: 'Automation', icon: Zap },
]

export default function DashboardSidebar({ user, org }: { user: any; org: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-omiflow-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-sm leading-tight">Omiflow</div>
          <div className="text-xs text-gray-400 truncate">{org?.name || 'Your Firm'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-omiflow-50 text-omiflow-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-omiflow-600' : ''}`} />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-1">Settings</div>
        </div>

        {settingsItems.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-omiflow-50 text-omiflow-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-omiflow-600' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 bg-omiflow-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-omiflow-700 text-xs font-semibold">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
            </div>
            <div className="text-xs text-gray-400 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
