'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardHeader({ user, org }: { user: any; org: any }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data || [])
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length)
    }
    load()
  }, [user.id])

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between relative">
      <div className="text-sm text-gray-500">
        Welcome back, <span className="font-medium text-gray-900">{user?.first_name || 'there'}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-red-100 text-red-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-omiflow-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setOpen(false)}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 ${!n.is_read ? 'bg-omiflow-50/50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          n.type === 'urgent' ? 'bg-red-500' :
                          n.type === 'warning' ? 'bg-yellow-500' :
                          n.type === 'success' ? 'bg-green-500' :
                          'bg-blue-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{n.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      No notifications yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
