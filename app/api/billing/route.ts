import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClientInstance, createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

const PLANS = {
  starter: {
    name: 'Starter',
    price: 9900, // £99/month in pence
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    features: ['Up to 500 calls/month', 'AI receptionist', 'Lead management', 'Email summaries', '1 phone number']
  },
  professional: {
    name: 'Professional',
    price: 19900, // £199/month
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || '',
    features: ['Unlimited calls', 'AI receptionist', 'Full dashboard', 'SMS notifications', 'Calendar sync', 'Up to 10 staff', '3 phone numbers']
  },
  enterprise: {
    name: 'Enterprise',
    price: 49900, // £499/month
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    features: ['Everything in Professional', 'Unlimited staff', 'Unlimited phone numbers', 'Custom AI training', 'Priority support', 'SLA guarantee']
  }
}

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient() as any
  const { data: billing } = await db.from('billing_subscriptions').select('*').eq('organization_id', orgId).single()

  return NextResponse.json({ billing, plans: PLANS })
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClientInstance(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, email').eq('id', user.id).single()
  const orgId = (userData as any)?.organization_id
  if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action, plan } = body
  const db = createServiceClient() as any

  const { data: billing } = await db.from('billing_subscriptions').select('*').eq('organization_id', orgId).single()
  const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()

  if (action === 'create_checkout') {
    const planConfig = PLANS[plan as keyof typeof PLANS]
    if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    // Create or get Stripe customer
    let customerId = billing?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (userData as any).email,
        name: org?.name,
        metadata: { organization_id: orgId }
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      metadata: { organization_id: orgId, plan }
    })

    return NextResponse.json({ url: session.url })
  }

  if (action === 'create_portal') {
    if (!billing?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
    })

    return NextResponse.json({ url: session.url })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
