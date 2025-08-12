import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint
export async function GET() {
  try {
    // Test if Stripe can be imported
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    return NextResponse.json({ 
      status: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      message: 'Basic webhook endpoint is working',
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      stripeTest: 'Stripe import successful'
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      message: 'Basic webhook endpoint is working',
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      stripeError: (error as Error).message
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log('Webhook POST received:', { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      contentType: req.headers.get('content-type'),
      timestamp: new Date().toISOString()
    });

    // If no signature, return success (for testing)
    if (!sig || !webhookSecret) {
      console.log('No signature or webhook secret, returning test response');
      return NextResponse.json({ 
        status: 'POST endpoint received (test mode)',
        timestamp: new Date().toISOString(),
        message: 'Webhook POST endpoint is working - no signature provided'
      });
    }

    // Process actual webhook
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    
    console.log('Webhook event processed:', event.type, event.id);
    
    // For now, just acknowledge the webhook
    // We'll add order processing logic later
    return NextResponse.json({ 
      status: 'Webhook processed successfully',
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      status: 'Webhook error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}
