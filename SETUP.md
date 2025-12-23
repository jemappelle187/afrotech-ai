# Afrotech.ai Setup Guide

Complete setup instructions for getting Afrotech.ai running locally and deploying to production.

## Prerequisites

- Node.js 18+ and npm
- Git
- Accounts for:
  - Spotify Developer Dashboard
  - Stripe
  - Vercel (for deployment)
  - Vercel Postgres or Neon (for database)

---

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Spotify OAuth

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app:
   - Name: Afrotech.ai
   - Description: Music vibe analysis app
   - Redirect URI: `http://localhost:3000/api/auth/callback/spotify`
3. Copy your **Client ID** and **Client Secret**

### 3. Set Up Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your **Publishable Key** and **Secret Key** from the API keys section
3. For webhooks (set up after deploying):
   - Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - Or skip webhook testing locally

### 4. Set Up Database

**Option A: Vercel Postgres**

1. Create a Vercel account
2. Create a new Postgres database
3. Copy connection string

**Option B: Neon**

1. Go to [Neon.tech](https://neon.tech)
2. Create a free project
3. Copy connection string

### 5. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Auth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-use-openssl-rand-base64-32

# Spotify
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback/spotify
SPOTIFY_SCOPE=user-read-email,playlist-read-private,user-library-read,user-top-read

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # Optional for local

# Postgres
POSTGRES_URL=postgresql://user:pass@host/db

# Slack (optional - for visit tracking notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 6. Initialize Database

Run the SQL commands from `DATABASE.sql` in your Postgres console:

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  environment TEXT NOT NULL,
  total_tips NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tips (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL,
  item TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE emails (
  id SERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. Add Audio File

Add your audio file as `public/sample-mix.mp3`. See `public/sample-mix.mp3.README` for guidelines.

### 8. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Production Deployment (Vercel)

### 1. Prepare Repository

```bash
git init
git add .
git commit -m "Initial commit: Afrotech.ai MVP"
git remote add origin https://github.com/yourusername/afrotech-ai.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Add Environment Variables

In Vercel project settings → Environment Variables, add all variables from your `.env.local`, but update URLs:

```env
NEXT_PUBLIC_SITE_URL=https://afrotech.ai
NEXTAUTH_URL=https://afrotech.ai
SPOTIFY_REDIRECT_URI=https://afrotech.ai/api/auth/callback/spotify
# ... rest of your variables
```

### 4. Configure Spotify Production App

1. Go back to Spotify Developer Dashboard
2. Edit Settings → Redirect URIs
3. Add: `https://afrotech.ai/api/auth/callback/spotify`
4. Save

### 5. Set Up Stripe Webhook

1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://afrotech.ai/api/stripe/webhook`
3. Listen to events: `checkout.session.completed`
4. Copy the webhook signing secret
5. Add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`

### 6. Add Custom Domain

1. In Vercel project settings → Domains
2. Add your domain (e.g., `afrotech.ai`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate to provision

### 7. Redeploy

After adding all env vars, trigger a redeploy:

```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

## Testing Checklist

### Local Testing

- [ ] Landing page loads
- [ ] Dark Room renders with 3D scene
- [ ] Beach page renders with different palette
- [ ] Audio plays on click (check browser console)
- [ ] Email capture works
- [ ] Spotify login flow works
- [ ] Stripe checkout redirects (test mode)

### Production Testing

- [ ] All pages accessible via HTTPS
- [ ] Custom domain works
- [ ] Spotify OAuth completes successfully
- [ ] Can fetch vibe analysis from Spotify
- [ ] Stripe payments complete
- [ ] Webhooks receive events (check Stripe dashboard)
- [ ] Database records tips and emails

---

## Common Issues

### Audio Won't Play

**Problem**: Browser blocks autoplay
**Solution**: Audio will start on first user click - this is expected behavior

### Spotify Auth Fails

**Problem**: Redirect URI mismatch
**Solution**: Ensure redirect URI in Spotify Dashboard exactly matches your env var

### Database Connection Fails

**Problem**: SSL/TLS issues
**Solution**: Ensure `?sslmode=require` is in your Postgres connection string

### Stripe Webhook Not Receiving Events

**Problem**: Webhook secret mismatch or endpoint not reachable
**Solution**:

- Verify webhook endpoint is: `https://yoursite.com/api/stripe/webhook`
- Check Stripe Dashboard → Webhooks for failed attempts
- Verify `STRIPE_WEBHOOK_SECRET` env var

### 3D Scene Not Rendering

**Problem**: WebGL not supported or Three.js errors
**Solution**: Check browser console for specific errors. Ensure latest Chrome/Firefox/Safari.

---

## Optional Enhancements

### Enable PostHog Analytics

Uncomment code in `lib/analytics.ts` and add:

```env
NEXT_PUBLIC_POSTHOG_KEY=your_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Add Icons

Generate and add:

- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

Use a tool like [Favicon Generator](https://realfavicongenerator.net/)

---

## Support

Need help? Check:

- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Spotify Web API Docs](https://developer.spotify.com/documentation/web-api)

Built with ❤️ for the Afrobeats + Tech community
