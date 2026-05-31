import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: any
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('Stripe webhook error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceClient() as any

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const orgId = session.metadata?.organization_id
    const plan = session.metadata?.plan

    if (orgId && session.subscription) {
      const Stripe = (await import('stripe')).default
      const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
      const sub = await stripe.subscriptions.retrieve(session.subscription)
      await db.from('billing_subscriptions').update({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        plan: plan || 'starter',
        status: 'active',
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('organization_id', orgId)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as any
    const Stripe = (await import('stripe')).default
    const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
    const customer = await stripe.customers.retrieve(sub.customer)
    const orgId = (customer as any).metadata?.organization_id

    if (orgId) {
      await db.from('billing_subscriptions').update({
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString()
      }).eq('organization_id', orgId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as any
    const Stripe = (await import('stripe')).default
    const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
    const customer = await stripe.customers.retrieve(sub.customer)
    const orgId = (customer as any).metadata?.organization_id

    if (orgId) {
      await db.from('billing_subscriptions').update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('organization_id', orgId)
    }
  }

  return NextResponse.json({ received: true })
}
