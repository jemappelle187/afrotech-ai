'use client';

import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function DrinkButton({ item }: { item: 'drink' | 'champagne' | 'wine' }) {
  const label = item === 'drink' 
    ? 'Buy a Drink 🍸' 
    : item === 'champagne' 
    ? 'Champagne 🍾' 
    : 'Wine 🍷';

  const onClick = async () => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  return (
    <button 
      onClick={onClick} 
      className="border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-colors"
    >
      {label}
    </button>
  );
}




