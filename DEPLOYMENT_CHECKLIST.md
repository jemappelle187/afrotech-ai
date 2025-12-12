# 🚢 Deployment Checklist

Use this checklist to ensure a smooth deployment to production.

## Pre-Deployment

### Code & Assets

- [ ] All dependencies installed (`npm install`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors (`npm run lint`)
- [ ] Audio file added (`public/sample-mix.mp3`) or streaming integrated
- [ ] Icons added (`public/icons/icon-192.png`, `icon-512.png`)
- [ ] All environment variables documented in `.env.example`

### API Keys & Services

- [ ] Spotify app created and configured
  - [ ] Client ID and Secret obtained
  - [ ] Redirect URI set to production URL
  - [ ] Scopes configured correctly
- [ ] Stripe account set up
  - [ ] Test mode keys obtained
  - [ ] Products/prices created (or using dynamic checkout)
- [ ] Database provisioned
  - [ ] Vercel Postgres or Neon account created
  - [ ] Connection string obtained
  - [ ] Tables created from `DATABASE.sql`
- [ ] Domain purchased (if using custom domain)

### Repository

- [ ] Code pushed to GitHub/GitLab/Bitbucket
- [ ] `.env.local` NOT committed (check `.gitignore`)
- [ ] README.md updated with project info
- [ ] License added (if open source)

## Vercel Deployment

### Initial Setup

- [ ] Vercel account created
- [ ] New project created from repository
- [ ] Framework preset set to "Next.js"
- [ ] Build settings verified

### Environment Variables

Add ALL of these in Vercel project settings:

#### URLs
- [ ] `NEXT_PUBLIC_SITE_URL` → Your production URL
- [ ] `NEXTAUTH_URL` → Your production URL

#### Auth
- [ ] `NEXTAUTH_SECRET` → Generate with `openssl rand -base64 32`

#### Spotify
- [ ] `SPOTIFY_CLIENT_ID`
- [ ] `SPOTIFY_CLIENT_SECRET`
- [ ] `SPOTIFY_REDIRECT_URI` → `https://yoursite.com/api/auth/callback/spotify`
- [ ] `SPOTIFY_SCOPE`

#### Stripe
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET` (add after webhook setup)

#### Database
- [ ] `POSTGRES_URL`
- [ ] `POSTGRES_USER`
- [ ] `POSTGRES_PASSWORD`
- [ ] `POSTGRES_HOST`
- [ ] `POSTGRES_DATABASE`

### First Deployment

- [ ] Trigger deployment
- [ ] Check deployment logs for errors
- [ ] Visit production URL
- [ ] Verify landing page loads

## Post-Deployment Configuration

### Spotify Setup

- [ ] Add production redirect URI in Spotify Dashboard
  - Format: `https://yoursite.com/api/auth/callback/spotify`
- [ ] Test Spotify login flow in production
- [ ] Verify token refresh works

### Stripe Setup

- [ ] Add webhook endpoint in Stripe Dashboard
  - URL: `https://yoursite.com/api/stripe/webhook`
  - Events: `checkout.session.completed`
- [ ] Copy webhook signing secret
- [ ] Add `STRIPE_WEBHOOK_SECRET` to Vercel env vars
- [ ] Redeploy to apply new env var
- [ ] Test payment flow in Stripe test mode
- [ ] Verify webhook receives events (check Stripe Dashboard)

### Domain Configuration

If using custom domain:

- [ ] Add domain in Vercel project settings
- [ ] Update DNS records as instructed
- [ ] Wait for SSL certificate (usually < 5 minutes)
- [ ] Verify HTTPS works
- [ ] Update Spotify redirect URI to new domain
- [ ] Update Stripe webhook URL to new domain
- [ ] Update all environment variables with new domain

### Database Verification

- [ ] Connect to production database
- [ ] Verify tables exist
- [ ] Test email capture (check `emails` table)
- [ ] Make test payment (check `tips` table)

## Testing in Production

### Functionality Tests

- [ ] Landing page loads and looks correct
- [ ] Dark Room page renders 3D scene
- [ ] Beach page renders with different palette
- [ ] Audio plays (click to start)
- [ ] Lights react to music beats
- [ ] Email capture works and saves to DB
- [ ] Spotify login flow completes
- [ ] Vibe analysis endpoint works (requires Spotify login)
- [ ] All three drink buttons work
- [ ] Stripe checkout opens
- [ ] Test payment completes
- [ ] Payment confirmation redirects back
- [ ] Webhook records payment in DB
- [ ] Flash effect shows after payment

### Performance Tests

- [ ] Lighthouse score > 80
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome

### Security Tests

- [ ] HTTPS enabled
- [ ] No sensitive data in client-side code
- [ ] API routes require authentication where needed
- [ ] Stripe webhook signature verified
- [ ] Environment variables not exposed

## Going Live Checklist

### Pre-Launch

- [ ] Switch Stripe to live mode
  - [ ] Get live API keys
  - [ ] Update environment variables
  - [ ] Update webhook to listen to live events
  - [ ] Redeploy
- [ ] Test real payment with small amount
- [ ] Set up error monitoring (Sentry/LogRocket)
- [ ] Set up analytics (PostHog/Google Analytics)
- [ ] Create backup of database

### Launch Day

- [ ] Announce on social media
- [ ] Monitor error logs
- [ ] Monitor Stripe dashboard
- [ ] Monitor database connection pool
- [ ] Be ready to rollback if needed

### Post-Launch

- [ ] Monitor application performance
- [ ] Check for error spikes
- [ ] Verify payments processing correctly
- [ ] Collect user feedback
- [ ] Plan first update/improvements

## Maintenance

### Weekly

- [ ] Check Vercel analytics
- [ ] Review Stripe transactions
- [ ] Check database size/usage
- [ ] Monitor error logs

### Monthly

- [ ] Update dependencies (`npm update`)
- [ ] Review security advisories
- [ ] Backup database
- [ ] Review costs (Vercel/Stripe/Database)

### As Needed

- [ ] Scale database if needed
- [ ] Optimize 3D assets if performance degrades
- [ ] Update audio content
- [ ] Add new features

## Rollback Plan

If something goes wrong:

1. **Quick Fix**: Revert to previous deployment in Vercel dashboard
2. **Code Fix**: 
   ```bash
   git revert HEAD
   git push
   ```
3. **Environment Fix**: Check Vercel logs, verify env vars
4. **Database Fix**: Restore from backup if needed

## Support Contacts

- **Vercel Support**: https://vercel.com/support
- **Stripe Support**: https://support.stripe.com/
- **Spotify Support**: https://developer.spotify.com/community/

---

## Success Criteria

Your deployment is successful when:

- ✅ All pages load without errors
- ✅ Spotify OAuth works
- ✅ Payments complete successfully
- ✅ Webhooks process correctly
- ✅ Database records data
- ✅ No console errors
- ✅ Mobile works perfectly
- ✅ HTTPS enabled

**Ready to launch? Let's go! 🚀**




