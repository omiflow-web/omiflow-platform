'use client'

import { useEffect, useState } from 'react'
import { Bot, Save } from 'lucide-react'

export default function AIConfigPage() {
  const [config, setConfig] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // In Phase 2 this will load/save via API
  useEffect(() => {
    setLoading(false)
  }, [])

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your AI receptionist's behaviour and voice</p>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">AI Receptionist</div>
            <div className="text-xs text-green-600 font-medium">● Active</div>
          </div>
        </div>
      </div>

      {/* Config fields */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Receptionist Settings</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Name</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
            defaultValue="AI Receptionist"
            placeholder="AI Receptionist" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500"
            placeholder="Thank you for calling [Firm Name]. I'm the virtual assistant — how can I help?" />
          <p className="text-xs text-gray-400 mt-1">Use [Firm Name] as a placeholder</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
            <option value="jennifer">Jennifer (Female, US)</option>
            <option value="rachel">Rachel (Female, US)</option>
            <option value="adam">Adam (Male, US)</option>
            <option value="josh">Josh (Male, US)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Call Duration</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500">
            <option value="300">5 minutes</option>
            <option value="600" selected>10 minutes</option>
            <option value="900">15 minutes</option>
            <option value="1200">20 minutes</option>
          </select>
        </div>
      </div>

      {/* Intake fields */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Intake Configuration</h2>
        <p className="text-sm text-gray-500">What information should the AI collect from callers?</p>

        {[
          { label: 'Collect caller name', key: 'collect_name', defaultChecked: true },
          { label: 'Collect callback number', key: 'collect_callback', defaultChecked: true },
          { label: 'Collect reason for calling', key: 'collect_reason', defaultChecked: true },
          { label: 'Book appointments', key: 'book_appointments', defaultChecked: false },
          { label: 'Use knowledge base', key: 'use_kb', defaultChecked: true },
        ].map(field => (
          <div key={field.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-700">{field.label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked={field.defaultChecked} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-omiflow-600" />
            </label>
          </div>
        ))}
      </div>

      {/* Automation */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Automation Rules</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Callback Promise (hours)</label>
            <input type="number" defaultValue={2} min={1} max={48}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            <p className="text-xs text-gray-400 mt-1">Triggers overdue alert after this time</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Threshold (hours)</label>
            <input type="number" defaultValue={24} min={1} max={168}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-omiflow-500" />
            <p className="text-xs text-gray-400 mt-1">Marks lead critical after this time</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Note:</strong> Full AI configuration management (saving to Vapi, live preview) will be completed in Phase 2. Changes here are currently read-only.
      </div>

      <button disabled className="flex items-center gap-2 bg-omiflow-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-omiflow-700 transition-colors disabled:opacity-50">
        <Save className="w-4 h-4" />
        Save Configuration (Phase 2)
      </button>
    </div>
  )
}
