# Afrotech.ai

> Where rhythm meets code.

An immersive digital experience combining Afrobeats, tech, and community. Built with Next.js, Three.js, Spotify, and Stripe.

## Features

- 🎵 **Dark Room** - 3D beat-reactive environment with immersive lighting
- 🏖️ **Beach Session** - Tropical palette toggle for different vibes
- 🎧 **Spotify Integration** - Connect your account for personalized "vibe" analysis and recommendations
- 💸 **Tip the DJ** - Buy drinks, wine, or champagne via Stripe
- 📊 **Analytics** - Track sessions, tips, and community engagement
- 📧 **Email Capture** - Build your tribe

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **3D Graphics**: Three.js + React Three Fiber
- **Authentication**: NextAuth.js + Spotify OAuth
- **Payments**: Stripe Checkout
- **Database**: Vercel Postgres / Neon
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXTAUTH_URL` and `NEXTAUTH_SECRET`
- Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- Stripe: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Postgres: `POSTGRES_URL` (and related vars)

### 3. Set Up Database

Run the SQL commands in `DATABASE.sql` in your Postgres console:

```sql
-- Creates sessions, tips, and emails tables
```

### 4. Add Audio File

Replace `public/sample-mix.mp3` with your actual audio file. Make sure you have the rights to use it.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment on Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your repository
3. Add all environment variables from `.env.local`
4. Deploy!

### 3. Configure Stripe Webhook

1. In Stripe Dashboard, add webhook endpoint:
   ```
   https://afrotech.ai/api/stripe/webhook
   ```
2. Listen for: `checkout.session.completed`
3. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

### 4. Configure Spotify Redirect URI

In your Spotify app settings, add:
```
https://afrotech.ai/api/auth/callback/spotify
```

### 5. Point Your Domain

In Vercel project settings, add your custom domain (e.g., `afrotech.ai`).

## Project Structure

```
afrotech-ai/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # NextAuth + Spotify
│   │   ├── spotify/      # Vibe analysis
│   │   ├── stripe/       # Payments
│   │   └── email/        # Email capture
│   ├── darkroom/         # Dark Room environment
│   ├── beach/            # Beach environment
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── Scene.tsx         # 3D scene
│   ├── MusicPlayer.tsx   # Audio + beat detection
│   ├── DrinkButton.tsx   # Stripe checkout
│   ├── AuthButton.tsx    # Spotify auth
│   └── EmailCapture.tsx  # Email signup
├── lib/                  # Utilities
│   ├── db.ts             # Postgres client
│   ├── stripe.ts         # Stripe config
│   ├── palettes.ts       # Color schemes
│   └── analytics.ts      # PostHog (optional)
└── public/               # Static assets
    ├── sample-mix.mp3    # Audio file
    └── manifest.json     # PWA manifest
```

## Future Enhancements

- [ ] Replace MP3 with YouTube/SoundCloud embed
- [ ] Add more 3D models (DJ booth, crowd, effects)
- [ ] Implement vibe-based lighting changes
- [ ] Add chat/community features
- [ ] Mobile app (React Native)
- [ ] AR/VR experiences

## License

MIT

## Support

Buy the DJ a drink! 🍸

Built with ❤️ for the Afrobeats + Tech community.




