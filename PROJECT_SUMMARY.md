# Afrotech.ai - Project Summary

## Overview

Afrotech.ai is a **web-based immersive music experience** that combines Afrobeats culture with modern web technologies. It features beat-reactive 3D environments, Spotify integration for personalized music recommendations, and a tipping system via Stripe.

## What's Included

### 🎯 Core Features

1. **Dark Room Environment**
   - 3D beat-reactive scene using Three.js
   - Real-time audio analysis and visualization
   - Dynamic lighting that responds to music beats
   - Immersive dark aesthetic

2. **Beach Environment**
   - Alternative tropical-themed palette
   - Same beat-reactive system
   - Warmer, beach-vibe colors

3. **Spotify Integration**
   - OAuth authentication
   - Analyzes user's playlists for "vibe" (BPM, energy, danceability, valence)
   - Generates personalized Afrobeats recommendations
   - API endpoint: `/api/spotify/vibe`

4. **Tipping System**
   - Three tiers: Drink (€3), Wine (€10), Champagne (€20)
   - Stripe Checkout integration
   - Webhook processing for payment confirmation
   - Database logging of all tips

5. **Email Capture**
   - Landing page signup form
   - Postgres storage with duplicate prevention
   - Build community mailing list

6. **Landing Page**
   - Modern, minimal design
   - Clear navigation to environments
   - Email capture CTA

## Technology Stack

### Frontend
- **Next.js 14** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Three.js** - 3D graphics
- **React Three Fiber** - React renderer for Three.js
- **Web Audio API** - Beat detection

### Backend
- **Next.js API Routes** - Serverless functions
- **NextAuth.js** - Authentication
- **Stripe** - Payment processing
- **Vercel Postgres** - Database (or Neon)

### External APIs
- **Spotify Web API** - Music data & recommendations
- **Stripe API** - Payment processing

## Project Structure

```
afrotech-ai/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # NextAuth + Spotify OAuth
│   │   ├── spotify/vibe/         # Vibe analysis endpoint
│   │   ├── stripe/               # Payment endpoints
│   │   │   ├── checkout/         # Create checkout session
│   │   │   └── webhook/          # Handle payment events
│   │   └── email/                # Email capture
│   ├── darkroom/                 # Dark Room page
│   ├── beach/                    # Beach page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── providers.tsx             # Client providers
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── Scene.tsx                 # 3D scene renderer
│   ├── MusicPlayer.tsx           # Audio player + beat detection
│   ├── DrinkButton.tsx           # Stripe checkout button
│   ├── AuthButton.tsx            # Spotify auth toggle
│   └── EmailCapture.tsx          # Email signup form
│
├── lib/                          # Utilities
│   ├── db.ts                     # Postgres client
│   ├── stripe.ts                 # Stripe config
│   ├── palettes.ts               # Color schemes
│   └── analytics.ts              # Analytics (optional)
│
├── public/                       # Static assets
│   ├── sample-mix.mp3            # Audio file (placeholder)
│   ├── manifest.json             # PWA manifest
│   └── icons/                    # App icons
│
└── Documentation
    ├── README.md                 # Main docs
    ├── SETUP.md                  # Detailed setup guide
    ├── QUICKSTART.md             # Quick start guide
    ├── DEPLOYMENT_CHECKLIST.md   # Deployment steps
    └── CONTRIBUTING.md           # Contribution guide
```

## Database Schema

### Tables

**sessions**
- Tracks DJ sessions
- Fields: id, environment, total_tips, created_at

**tips**
- Records all payments
- Fields: id, session_id, amount_cents, item, message, created_at

**emails**
- Stores email signups
- Fields: id, address (unique), created_at

## Key Features Explained

### Beat Detection

The `MusicPlayer` component uses the Web Audio API to:
1. Create an audio context
2. Connect an analyser node
3. Sample frequency data (FFT)
4. Focus on bass frequencies (0-10 bins)
5. Normalize to 0-1 range
6. Pass to Scene component for visualization

### 3D Visualization

The `Scene` component:
- Renders with React Three Fiber (declarative Three.js)
- Adjusts light intensity based on beat strength
- Changes colors based on environment (darkroom/beach)
- Creates simple placeholder geometry (floor, DJ booth, crowd)
- Can be extended with complex 3D models

### Spotify Vibe Analysis

The `/api/spotify/vibe` endpoint:
1. Fetches user's playlists
2. Extracts up to 100 tracks
3. Calls Spotify's audio features API
4. Calculates averages for: BPM, energy, danceability, valence
5. Uses averages to seed recommendation algorithm
6. Returns personalized Afrobeats tracks

### Payment Flow

1. User clicks "Buy a Drink" button
2. Frontend calls `/api/stripe/checkout`
3. Server creates Stripe Checkout session
4. User redirects to Stripe (secure payment page)
5. After payment, redirects back with `?paid=true`
6. Stripe sends webhook to `/api/stripe/webhook`
7. Server verifies signature and logs payment
8. Frontend shows flash effect

## Environment Variables Required

### Development
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>
SPOTIFY_CLIENT_ID=<from-spotify-dashboard>
SPOTIFY_CLIENT_SECRET=<from-spotify-dashboard>
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback/spotify
SPOTIFY_SCOPE=user-read-email,playlist-read-private,user-library-read,user-top-read
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
POSTGRES_URL=postgresql://...
```

### Production
Same as development, but with production URLs and live Stripe keys.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy
5. Configure custom domain
6. Set up Stripe webhook
7. Update Spotify redirect URI

See `DEPLOYMENT_CHECKLIST.md` for complete steps.

## Future Enhancements

### High Priority
- Replace MP3 with YouTube/SoundCloud embeds
- Add more sophisticated 3D models
- Improve mobile performance
- Add more environments

### Features
- User profiles and history
- Playlist creation from recommendations
- Social sharing
- Live DJ events
- Chat/community features
- AR/VR modes

### Technical
- Server-side rendering for 3D
- WebGL optimizations
- Progressive Web App features
- Real-time analytics dashboard
- A/B testing framework

## Performance Targets

- **Lighthouse Score**: > 80
- **First Contentful Paint**: < 2s
- **Time to Interactive**: < 3s
- **3D Scene FPS**: > 30fps on mid-range devices

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Android

Requires WebGL and Web Audio API support.

## Security Considerations

- Environment variables never exposed to client
- Stripe webhook signatures verified
- NextAuth handles OAuth securely
- Database queries use parameterized statements
- HTTPS enforced in production

## Cost Estimate (Monthly)

- **Vercel**: Free tier (then ~$20/mo for Pro)
- **Vercel Postgres**: Free tier with limits (then ~$20/mo)
- **Stripe**: 2.9% + €0.30 per transaction
- **Spotify API**: Free
- **Domain**: ~€10-15/year

**Total**: Free to start, ~€40-60/mo at scale

## Success Metrics

- Active users
- Spotify connections
- Tips received
- Email signups
- Session duration
- Repeat visits

## Support & Maintenance

- Regular dependency updates
- Monitor error logs (Vercel)
- Track payments (Stripe Dashboard)
- Database backups
- Security patches

## License

MIT License - See LICENSE file

## Credits

- Built with Next.js, React, Three.js
- Powered by Spotify & Stripe APIs
- Deployed on Vercel
- Created for the Afrobeats + Tech community

---

**Built with ❤️ by the Afrotech.ai team**

For questions, see README.md or open an issue.




