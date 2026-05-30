'use client'

import { Bell } from 'lucide-react'

export default function DashboardHeader({ user, org }: { user: any; org: any }) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
      <div className="text-sm text-gray-500">
        Welcome back, <span className="font-medium text-gray-900">{user?.first_name || 'there'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
