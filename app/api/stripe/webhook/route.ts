import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const buf = Buffer.from(await req.arrayBuffer());
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      buf, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as any;
    const amount_total = s.amount_total as number;
    const url = (s.success_url || '') as string;
    
    // Extract item from success_url query params
    const item = (() => { 
      try { 
        return new URL(url).searchParams.get('item') || 'drink'; 
      } catch { 
        return 'drink'; 
      }
    })();
    
    await pool.query(
      'INSERT INTO tips (session_id, amount_cents, item) VALUES ($1, $2, $3)', 
      [null, amount_total, item]
    );
  }
  
  return NextResponse.json({ received: true });
}




