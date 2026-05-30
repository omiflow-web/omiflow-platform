import { createServerClientInstance } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, isToday, isFuture } from 'date-fns'
import { Calendar, Clock, User } from 'lucide-react'

export default async function CalendarPage() {
  const supabase = createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) redirect('/auth/login')

  const orgId = userData.organization_id

  const now = new Date()
  const start = startOfMonth(now)
  const end = endOfMonth(now)

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, lead:leads(first_name, last_name, phone), staff:staff_members(first_name, last_name)')
    .eq('organization_id', orgId)
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
    .order('starts_at', { ascending: true })

  const upcoming = appointments?.filter(a => isFuture(new Date(a.starts_at)) || isToday(new Date(a.starts_at))) || []
  const past = appointments?.filter(a => !isFuture(new Date(a.starts_at)) && !isToday(new Date(a.starts_at))) || []

  function AppointmentCard({ appt }: { appt: any }) {
    const lead = appt.lead
    const staff = appt.staff
    const leadName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.phone : 'Unknown'

    return (
      <div className={`bg-white rounded-xl border p-4 ${
        isToday(new Date(appt.starts_at)) ? 'border-omiflow-300 bg-omiflow-50/20' : 'border-gray-100'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium text-gray-900 text-sm">{appt.title}</div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(appt.starts_at), 'PPp')}
              </span>
              <span>{appt.duration_minutes}min</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <a href={lead ? `/dashboard/leads/${appt.lead_id}` : '#'} className="text-xs text-omiflow-600 hover:underline flex items-center gap-1">
                <User className="w-3 h-3" />{leadName}
              </a>
              {staff && <span className="text-xs text-gray-400">with {staff.first_name} {staff.last_name}</span>}
            </div>
          </div>
          <div className="flex gap-1.5">
            {isToday(new Date(appt.starts_at)) && (
              <span className="text-xs bg-omiflow-100 text-omiflow-700 px-2 py-0.5 rounded-full font-medium">Today</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              appt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
              appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
              appt.status === 'completed' ? 'bg-gray-100 text-gray-600' :
              'bg-red-100 text-red-600'
            }`}>{appt.status}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(now, 'MMMM yyyy')}</p>
        </div>
        <div className="text-sm text-gray-500">
          {upcoming.length} upcoming · {past.length} past this month
        </div>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-500 font-medium">No appointments this month</div>
          <p className="text-gray-400 text-sm mt-1">Appointments booked via the AI or manually will appear here.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map(a => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Past This Month</h2>
          <div className="space-y-3 opacity-60">
            {past.map(a => <AppointmentCard key={a.id} appt={a} />)}
          </div>
        </div>
      )}
    </div>
  )
}
