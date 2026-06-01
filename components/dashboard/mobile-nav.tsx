'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Phone, Users, CheckSquare, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/dashboard/settings/ai-config', label: 'Settings', icon: Settings },
]

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden">
      <div className="grid grid-cols-5 px-2 py-2 pb-safe">
        {navItems.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href} prefetch={true}
              className="flex flex-col items-center gap-0.5 py-1 px-1">
              <item.icon className={`w-5 h-5 ${active ? 'text-omiflow-600' : 'text-gray-400'}`} />
              <span className={`text-[9px] ${active ? 'text-omiflow-600 font-medium' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
