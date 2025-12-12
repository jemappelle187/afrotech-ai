import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_MAP } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const { item = 'drink', success_url, cancel_url } = await req.json();
  const price = PRICE_MAP[item as keyof typeof PRICE_MAP];
  
  if (!price) {
    return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: price.currency,
        product_data: { name: price.name },
        unit_amount: price.amount,
      },
      quantity: 1,
    }],
    success_url: success_url || `${process.env.NEXT_PUBLIC_SITE_URL}/darkroom?paid=true&item=${item}`,
    cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_SITE_URL}/darkroom?paid=false`,
  });

  return NextResponse.json({ 
    id: session.id, 
    url: session.url 
  });
}




