'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, CreditCard, Zap } from 'lucide-react'

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '£99',
    period: '/month',
    description: 'Perfect for smaller firms getting started',
    features: [
      'Up to 500 calls/month',
      'AI receptionist',
      'Lead management dashboard',
      'Email call summaries',
      '1 phone number',
      'Standard support'
    ],
    color: 'border-gray-200',
    buttonColor: 'bg-gray-900 hover:bg-gray-800'
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '£199',
    period: '/month',
    description: 'For growing firms that need everything',
    features: [
      'Unlimited calls',
      'AI receptionist',
      'Full dashboard and reports',
      'SMS notifications to callers',
      'Calendar sync',
      'Up to 10 staff members',
      '3 phone numbers',
      'Priority support'
    ],
    color: 'border-omiflow-500',
    buttonColor: 'bg-omiflow-600 hover:bg-omiflow-700',
    badge: 'Most Popular'
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '£499',
    period: '/month',
    description: 'For large firms needing full scale',
    features: [
      'Everything in Professional',
      'Unlimited staff members',
      'Unlimited phone numbers',
      'Custom AI training',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom integrations'
    ],
    color: 'border-gray-200',
    buttonColor: 'bg-gray-900 hover:bg-gray-800'
  }
]

export default function BillingPage() {
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  useEffect(() => {
    fetch('/api/billing').then(r => r.json()).then(d => {
      setBilling(d.billing)
      setLoading(false)
    })
  }, [])

  async function handlePlanSelect(planKey: string) {
    setRedirecting(planKey)
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_checkout', plan: planKey })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setRedirecting(null)
  }

  async function handleManageBilling() {
    setRedirecting('portal')
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_portal' })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setRedirecting(null)
  }

  const isActive = billing?.status === 'active'
  const isTrialing = billing?.status === 'trialing'
  const currentPlan = billing?.plan || 'starter'

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and plan</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-green-800">Payment successful</div>
            <div className="text-sm text-green-700">Your subscription is now active. Thank you!</div>
          </div>
        </div>
      )}

      {/* Current plan status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-omiflow-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-omiflow-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 capitalize">
                {currentPlan} Plan
              </div>
              <div className={`text-xs font-medium flex items-center gap-1 ${
                isActive ? 'text-green-600' : isTrialing ? 'text-yellow-600' : 'text-gray-400'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                {isTrialing ? 'Free trial' : isActive ? 'Active' : billing?.status || 'No subscription'}
              </div>
            </div>
          </div>
          {(isActive || isTrialing) && billing?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={redirecting === 'portal'}
              className="border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              {redirecting === 'portal' ? 'Opening...' : 'Manage Billing'}
            </button>
          )}
        </div>
        {isTrialing && (
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-800">
            You're on a free trial. Subscribe to a plan to continue using Omiflow after your trial ends.
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="grid lg:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key && isActive
          return (
            <div key={plan.key} className={`bg-white rounded-xl border-2 p-6 relative ${plan.color} ${plan.badge ? 'shadow-md' : ''}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-omiflow-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-4">
                <div className="font-bold text-gray-900 text-lg">{plan.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{plan.description}</div>
              </div>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full text-center py-2.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handlePlanSelect(plan.key)}
                  disabled={redirecting === plan.key}
                  className={`w-full text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 ${plan.buttonColor}`}>
                  {redirecting === plan.key ? 'Redirecting...' : isTrialing ? `Subscribe to ${plan.name}` : `Switch to ${plan.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        All prices exclude VAT. Cancel anytime. Secure payments via Stripe.
      </p>
    </div>
  )
}
