'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, Phone, MapPin } from 'lucide-react'

const typeIcon: Record<string, any> = {
  consultation: User,
  virtual: Video,
  phone: Phone,
  in_person: MapPin,
  follow_up: Clock
}

const typeLabel: Record<string, string> = {
  consultation: 'Consultation',
  virtual: 'Virtual',
  phone: 'Phone Call',
  in_person: 'In Person',
  follow_up: 'Follow Up'
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
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
        .gte('starts_at', start)
        .lte('starts_at', end)
        .order('starts_at', { ascending: true })

      setAppointments(data || [])
      setLoading(false)
    }
    load()
  }, [currentMonth])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startDayOfWeek = startOfMonth(currentMonth).getDay()
  // Adjust for Monday start
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  const appointmentsOnDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.starts_at), day))

  const selectedDayAppointments = selectedDay ? appointmentsOnDay(selectedDay) : []

  const upcoming = appointments.filter(a => new Date(a.starts_at) >= new Date()).slice(0, 5)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Consultations and appointments</p>
        </div>
        <button className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Calendar className="w-4 h-4" />
          Sync to Google Calendar
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map(day => {
              const dayAppts = appointmentsOnDay(day)
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const isCurrentDay = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square flex flex-col items-center justify-start pt-1.5 rounded-lg text-sm transition-colors relative ${
                    isSelected ? 'bg-omiflow-600 text-white' :
                    isCurrentDay ? 'bg-omiflow-50 text-omiflow-700 font-semibold' :
                    'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-xs font-medium">{format(day, 'd')}</span>
                  {dayAppts.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayAppts.slice(0, 3).map((_, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-omiflow-500'}`} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day appointments */}
          {selectedDay && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEEE d MMMM')}
                {selectedDayAppointments.length > 0 && (
                  <span className="ml-2 text-xs font-medium text-gray-400">
                    {selectedDayAppointments.length} appointment{selectedDayAppointments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h3>
              {selectedDayAppointments.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayAppointments.map(appt => {
                    const lead = appt.lead
                    const staff = appt.staff
                    const Icon = typeIcon[appt.type] || User
                    const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : 'Unknown'

                    return (
                      <div key={appt.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-omiflow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-omiflow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-900 text-sm">{appt.title}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              appt.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                              appt.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>{appt.status}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {format(parseISO(appt.starts_at), 'h:mm a')} · {appt.duration_minutes}min · {typeLabel[appt.type] || appt.type}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {leadName}
                            {staff ? ` · with ${staff.first_name} ${staff.last_name}` : ''}
                          </div>
                          {appt.meeting_url && (
                            <a href={appt.meeting_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-omiflow-600 hover:underline mt-1 block">
                              Join meeting →
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No appointments on this day</p>
              )}
            </div>
          )}
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Upcoming</h2>
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map(appt => {
                  const lead = appt.lead
                  const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : 'Unknown'
                  const Icon = typeIcon[appt.type] || User
                  const daysUntil = Math.ceil((new Date(appt.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

                  return (
                    <div key={appt.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-omiflow-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-omiflow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{leadName}</div>
                        <div className="text-xs text-gray-500">
                          {format(parseISO(appt.starts_at), 'EEE d MMM · h:mm a')}
                        </div>
                        <div className="text-xs text-omiflow-600 font-medium mt-0.5">
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No upcoming appointments</p>
                <p className="text-xs text-gray-300 mt-1">Appointments booked by the AI or staff appear here</p>
              </div>
            )}
          </div>

          {/* Month summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">{format(currentMonth, 'MMMM')} Summary</h2>
            <div className="space-y-2">
              {[
                { label: 'Total booked', value: appointments.length },
                { label: 'Consultations', value: appointments.filter(a => a.type === 'consultation').length },
                { label: 'Virtual', value: appointments.filter(a => a.type === 'virtual').length },
                { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length },
                { label: 'Cancelled', value: appointments.filter(a => a.status === 'cancelled').length },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
