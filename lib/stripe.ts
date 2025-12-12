import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
  apiVersion: '2023-10-16' 
});

export const PRICE_MAP = {
  drink: { 
    name: 'Buy the DJ a Drink', 
    amount: 300, 
    currency: 'eur' 
  },
  champagne: { 
    name: 'Champagne Bottle', 
    amount: 2000, 
    currency: 'eur' 
  },
  wine: { 
    name: 'Wine Bottle', 
    amount: 1000, 
    currency: 'eur' 
  },
} as const;



