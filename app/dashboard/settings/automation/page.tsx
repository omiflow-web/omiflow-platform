'use client'

import { useState, useEffect } from 'react'
import { Zap, Clock, AlertTriangle, Calendar, RefreshCw, CheckCircle } from 'lucide-react'

const automationRules = [
  {
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-600',
    title: 'Overdue Callback Alert',
    description: 'When a new lead has not been contacted within your callback promise window, a task is created and the notification email is alerted.',
    trigger: 'Lead status = New + age > callback_promise_hours',
    action: 'Create task + in-app notification + email alert'
  },
  {
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-600',
    title: 'Lead Escalation',
    description: 'When a lead has been inactive beyond the escalation threshold, it is marked Critical and an urgent notification is sent — including SMS to the notification phone.',
    trigger: 'Lead inactive > escalation_hours',
    action: 'Mark Critical + urgent notification + SMS to manager'
  },
  {
    icon: Calendar,
    color: 'bg-blue-100 text-blue-600',
    title: 'Consultation Reminder',
    description: 'An SMS is automatically sent to the lead 24 hours before their scheduled consultation.',
    trigger: '24 hours before appointment starts_at',
    action: 'SMS reminder to lead'
  },
  {
    icon: RefreshCw,
    color: 'bg-orange-100 text-orange-600',
    title: 'Missed Consultation Follow-up',
    description: 'When a scheduled consultation passes without being marked complete, the appointment is flagged as a no-show, a rescheduling task is created, and an SMS is sent to the lead.',
    trigger: 'Appointment ends_at passed + status = scheduled',
    action: 'Mark no-show + create task + SMS to lead'
  },
  {
    icon: Zap,
    color: 'bg-purple-100 text-purple-600',
    title: '7-Day Re-engagement',
    description: 'When a contacted lead has had no activity for 7 days, a gentle follow-up task is created to prompt the team to re-engage.',
    trigger: 'Lead status = Contacted + last_contact_at > 7 days ago',
    action: 'Create follow-up task'
  }
]

export default function AutomationPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setSettings(d.settings)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', data: settings })
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rules that run automatically in the background — no action needed from your team</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Settings saved
        </div>
      )}

      {/* Thresholds */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Timing Rules</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Callback Promise (hours)</label>
            <input type="number"
              value={settings?.callback_promise_hours || 2}
              onChange={e => setSettings((p: any) => ({ ...p, callback_promise_hours: parseInt(e.target.value) }))}
              min={1} max={48}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            <p className="text-xs text-gray-400 mt-1">Overdue alert fires after this many hours</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Threshold (hours)</label>
            <input type="number"
              value={settings?.escalation_hours || 24}
              onChange={e => setSettings((p: any) => ({ ...p, escalation_hours: parseInt(e.target.value) }))}
              min={1} max={168}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            <p className="text-xs text-gray-400 mt-1">Lead marked critical after this many hours</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Manager SMS Number</label>
          <input
            value={settings?.notification_phone || ''}
            onChange={e => setSettings((p: any) => ({ ...p, notification_phone: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
            placeholder="+447911123456" />
          <p className="text-xs text-gray-400 mt-1">Receives SMS for escalations and urgent leads</p>
        </div>
        <button onClick={save} disabled={saving}
          className="bg-omiflow-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-omiflow-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Rules overview */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Active Automation Rules</h2>
        <p className="text-sm text-gray-500 mb-5">These run automatically every day. All rules are always active.</p>
        <div className="space-y-4">
          {automationRules.map((rule, i) => (
            <div key={i} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.color}`}>
                <rule.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm mb-1">{rule.title}</div>
                <p className="text-xs text-gray-500 mb-2">{rule.description}</p>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-xs text-gray-400">
                    <span className="font-medium text-gray-600">Trigger:</span> {rule.trigger}
                  </span>
                  <span className="text-xs text-gray-400">
                    <span className="font-medium text-gray-600">Action:</span> {rule.action}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
