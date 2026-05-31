'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, CreditCard, Shield, Zap, Phone, Users, BarChart3, Calendar } from 'lucide-react'

export default function BillingPage() {
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [portalRedirecting, setPortalRedirecting] = useState(false)
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  useEffect(() => {
    fetch('/api/billing').then(r => r.json()).then(d => {
      setBilling(d.billing)
      setLoading(false)
    })
  }, [])

  async function handleSubscribe() {
    setRedirecting(true)
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_checkout', plan: 'professional' })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setRedirecting(false)
  }

  async function handleManageBilling() {
    setPortalRedirecting(true)
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_portal' })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPortalRedirecting(false)
  }

  const isActive = billing?.status === 'active'
  const isTrialing = billing?.status === 'trialing'

  const features = [
    { icon: Phone, label: 'AI receptionist on your firm\'s number', desc: 'Answers every missed call, 24/7' },
    { icon: Users, label: 'Complete lead management', desc: 'Every caller becomes a tracked lead automatically' },
    { icon: Zap, label: 'Automation engine', desc: 'Overdue alerts, escalations, consultation reminders' },
    { icon: BarChart3, label: 'Full reporting dashboard', desc: 'Call volume, sentiment, pipeline, retention rate' },
    { icon: Calendar, label: 'Calendar and appointments', desc: 'AI books consultations directly into your calendar' },
    { icon: Shield, label: 'Knowledge base', desc: 'AI answers from your own uploaded documents' },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your Omiflow subscription</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-green-800">Payment successful — welcome to Omiflow</div>
            <div className="text-sm text-green-700">Your subscription is now active.</div>
          </div>
        </div>
      )}

      {/* Current status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-omiflow-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-omiflow-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Omiflow Platform</div>
              <div className={`text-xs font-medium flex items-center gap-1 mt-0.5 ${
                isActive ? 'text-green-600' : isTrialing ? 'text-yellow-600' : 'text-gray-400'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                {isTrialing ? 'Free trial active' : isActive ? 'Subscription active' : loading ? 'Loading...' : 'No active subscription'}
              </div>
            </div>
          </div>
          {isActive && billing?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={portalRedirecting}
              className="border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              {portalRedirecting ? 'Opening...' : 'Manage Billing'}
            </button>
          )}
        </div>

        {isActive && billing?.current_period_end && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
            Next billing date: <span className="font-medium text-gray-900">
              {new Date(billing.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        {isTrialing && (
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-800">
            You're currently on a free trial. Subscribe below to keep your account active.
          </div>
        )}
      </div>

      {/* Plan card */}
      {!isActive && (
        <div className="bg-white rounded-xl border-2 border-omiflow-500 p-6 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-bold text-gray-900 text-xl">Omiflow Platform</div>
              <div className="text-gray-500 text-sm mt-0.5">Everything your firm needs — no lead ever forgotten</div>
            </div>
            <div className="bg-omiflow-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Early access pricing
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-end gap-6 mb-6 pb-6 border-b border-gray-100">
            <div>
              <div className="text-xs text-gray-500 mb-1">One-time setup</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£3,500</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Platform setup, configuration and onboarding</div>
            </div>
            <div className="text-gray-300 text-2xl font-light">+</div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Monthly subscription</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">£300</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Locked in for early clients</div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-omiflow-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-3.5 h-3.5 text-omiflow-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-900">{f.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubscribe}
            disabled={redirecting}
            className="w-full bg-omiflow-600 hover:bg-omiflow-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
            {redirecting ? 'Redirecting to payment...' : 'Subscribe — £300/month'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Secure payment via Stripe · Cancel anytime · Prices exclude VAT
          </p>
        </div>
      )}

      {/* Already active — show what's included */}
      {isActive && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">What's included in your plan</h2>
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-900">{f.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        <strong className="text-gray-700">Questions about billing?</strong> Contact us at{' '}
        <a href="mailto:hello@omiflow.co.uk" className="text-omiflow-600 hover:underline">hello@omiflow.co.uk</a>
      </div>
    </div>
  )
}
