'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, Phone, MapPin, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

const typeIcon: Record<string, any> = { consultation: User, virtual: Video, phone: Phone, in_person: MapPin, follow_up: Clock }
const typeLabel: Record<string, string> = { consultation: 'Consultation', virtual: 'Virtual Meeting', phone: 'Phone Call', in_person: 'In Person', follow_up: 'Follow Up' }

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<any[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    loadData()
    // Show success/error from OAuth redirect
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected) {
      // Reload to show updated integration status
      loadIntegrations()
    }
  }, [currentMonth])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
    const orgId = (userData as any)?.organization_id
    if (!orgId) return

    const start = startOfMonth(currentMonth).toISOString()
    const end = endOfMonth(currentMonth).toISOString()

    const { data } = await supabase
      .from('appointments')
      .select('*, lead:leads(first_name, last_name, phone), staff:staff_members(first_name, last_name)')
      .eq('organization_id', orgId)
      .gte('starts_at', start).lte('starts_at', end)
      .order('starts_at', { ascending: true })

    setAppointments(data || [])
    setLoading(false)
    await loadIntegrations()
  }

  async function loadIntegrations() {
    const res = await fetch('/api/calendar')
    const data = await res.json()
    setIntegrations(data.integrations || [])
  }

  async function connectCalendar(provider: string) {
    setConnecting(provider)
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', provider })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setConnecting(null)
  }

  async function disconnectCalendar(provider: string) {
    await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', provider })
    })
    await loadIntegrations()
  }

  const googleIntegration = integrations.find(i => i.provider === 'google')

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startDayOfWeek = startOfMonth(currentMonth).getDay()
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
  const appointmentsOnDay = (day: Date) => appointments.filter(a => isSameDay(parseISO(a.starts_at), day))
  const selectedDayAppointments = selectedDay ? appointmentsOnDay(selectedDay) : []
  const upcoming = appointments.filter(a => new Date(a.starts_at) >= new Date()).slice(0, 5)

  const connected = searchParams.get('connected')
  const oauthError = searchParams.get('error')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Consultations and appointments</p>
        </div>
        <div className="flex gap-2">
          {/* Google Calendar */}
          <div className="flex items-center gap-2">
            {googleIntegration?.is_active ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Google Connected</span>
                <button onClick={() => disconnectCalendar('google')} className="text-xs text-red-500 hover:underline ml-1">Disconnect</button>
              </div>
            ) : (
              <button onClick={() => connectCalendar('google')} disabled={connecting === 'google'}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                {connecting === 'google' ? <Loader className="w-4 h-4 animate-spin" /> : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Sync Google Calendar
              </button>
            )}
          </div>
