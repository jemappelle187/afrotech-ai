# Troubleshooting Guide

Common issues and their solutions.

## Installation Issues

### npm install fails

**Problem**: Package installation errors

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Or use specific Node version
nvm use 18
npm install
```

### TypeScript errors during build

**Problem**: Type errors in dependencies

**Solution**: Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## Runtime Errors

### Audio won't play

**Problem**: Browser blocks autoplay

**Symptoms**: No sound, console shows autoplay error

**Solution**: 
- This is expected! Audio requires user interaction
- Click anywhere on the page to start
- The app already handles this automatically

**Still not working?**
- Check browser console for specific errors
- Verify `public/sample-mix.mp3` exists
- Try different browser (Chrome recommended)

### 3D Scene not rendering

**Problem**: Blank screen or WebGL error

**Symptoms**: Black screen, no 3D visuals

**Solutions**:
1. Check browser console for errors
2. Verify WebGL support: Visit https://get.webgl.org/
3. Update graphics drivers
4. Try different browser
5. Check if hardware acceleration is enabled

**Code fix**:
```tsx
// Add error boundary in Scene.tsx
<ErrorBoundary fallback={<div>3D scene unavailable</div>}>
  <Canvas>...</Canvas>
</ErrorBoundary>
```

### Page shows blank after deployment

**Problem**: Build succeeds but page is blank

**Solutions**:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Check for console errors (F12)
4. Ensure build output is `.next/` directory

## Authentication Issues

### Spotify login fails

**Problem**: Redirect loop or error after Spotify auth

**Symptoms**: "Redirect URI mismatch" or endless redirects

**Solution**:
1. Verify redirect URI in Spotify Dashboard **exactly** matches:
   ```
   http://localhost:3000/api/auth/callback/spotify  (dev)
   https://yoursite.com/api/auth/callback/spotify   (prod)
   ```
2. No trailing slashes!
3. Check `SPOTIFY_REDIRECT_URI` in `.env.local`
4. Restart dev server after env changes

### NextAuth session is null

**Problem**: `useSession()` returns null even after login

**Solution**:
```bash
# Verify NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET

# Generate new secret if needed
openssl rand -base64 32

# Clear cookies and try again
```

## Database Issues

### Connection refused

**Problem**: Cannot connect to Postgres

**Symptoms**: "ECONNREFUSED" or "Connection timeout"

**Solutions**:
1. Verify `POSTGRES_URL` is correct
2. Check database is running
3. Verify IP allowlist (for cloud databases)
4. Add `?sslmode=require` to connection string if using SSL

### Tables don't exist

**Problem**: "relation does not exist" errors

**Solution**:
```sql
-- Run this in your Postgres console
-- Copy from DATABASE.sql

CREATE TABLE sessions (...);
CREATE TABLE tips (...);
CREATE TABLE emails (...);
```

### Duplicate key error

**Problem**: Email capture fails with duplicate error

**Symptoms**: "duplicate key value violates unique constraint"

**This is expected**: The email already exists
- The code handles this gracefully with `ON CONFLICT DO NOTHING`
- User sees success message either way
- If seeing error in UI, check API route error handling

## Payment Issues

### Stripe checkout doesn't open

**Problem**: Click "Buy a Drink" - nothing happens

**Solutions**:
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
3. Must start with `pk_test_` or `pk_live_`
4. Check API route is responding: 
   ```bash
   curl -X POST http://localhost:3000/api/stripe/checkout \
     -H "Content-Type: application/json" \
     -d '{"item":"drink"}'
   ```

### Webhook not receiving events

**Problem**: Payments work but not recorded in database

**Symptoms**: Tips table empty after successful payment

**Solutions**:

**For Local Development**:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook secret shown and add to .env.local
STRIPE_WEBHOOK_SECRET=whsec_...
```

**For Production**:
1. Add webhook in Stripe Dashboard
2. URL: `https://yoursite.com/api/stripe/webhook`
3. Events: `checkout.session.completed`
4. Copy signing secret
5. Add to Vercel environment variables
6. Redeploy

**Verify webhook**:
- Check Stripe Dashboard → Webhooks → Attempts
- Look for 200 status codes
- Check Vercel function logs

## Performance Issues

### 3D scene is laggy

**Problem**: Low FPS, choppy animations

**Solutions**:
1. Lower polygon count in 3D models
2. Reduce light count
3. Add performance monitoring:
   ```tsx
   <Canvas performance={{ min: 0.5 }}>
   ```
4. Use `<Suspense>` for lazy loading
5. Implement LOD (Level of Detail)

### Slow page load

**Problem**: Takes too long to load initially

**Solutions**:
1. Optimize audio file size
2. Use Next.js Image optimization
3. Lazy load Three.js:
   ```tsx
   const Scene = dynamic(() => import('@/components/Scene'), { ssr: false })
   ```
4. Check Vercel Analytics for insights

## Deployment Issues

### Build fails on Vercel

**Problem**: Build succeeds locally but fails on Vercel

**Solutions**:
1. Check Vercel build logs for specific error
2. Verify all env vars are set
3. Ensure no `devDependencies` needed in prod
4. Check for module resolution issues

**Common fix**:
```json
// package.json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Environment variables not working

**Problem**: Env vars work locally but not in production

**Solutions**:
1. Verify vars are set in Vercel dashboard
2. Must start with `NEXT_PUBLIC_` for client-side access
3. Redeploy after adding env vars
4. Check variable names (case-sensitive)

### Custom domain not working

**Problem**: Domain shows Vercel 404

**Solutions**:
1. Verify DNS records are correct
2. Wait for DNS propagation (up to 48 hours, usually < 1 hour)
3. Check SSL certificate provisioned
4. Try incognito/private browsing

## API Issues

### Spotify vibe endpoint returns 401

**Problem**: `/api/spotify/vibe` returns unauthorized

**Solution**:
- User must be logged in with Spotify
- Check session: `const { data: session } = useSession()`
- Verify token hasn't expired (refresh handled automatically)

### CORS errors

**Problem**: Cross-origin request blocked

**Solution**: Next.js API routes should handle this automatically
If issue persists:
```ts
// In API route
export async function GET(req: NextRequest) {
  const response = NextResponse.json({ data });
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
}
```

## Common Error Messages

### "Cannot find module '@/...'""

**Problem**: Path alias not working

**Solution**: Verify `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### "Hydration failed"

**Problem**: React hydration mismatch

**Common causes**:
- Using `window` or `localStorage` during SSR
- Different client/server rendering

**Solution**:
```tsx
// Use client-only rendering for components using browser APIs
'use client'

useEffect(() => {
  // Browser code here
}, [])
```

### "Module not found: Can't resolve 'three'"

**Problem**: Three.js not installed or import issue

**Solution**:
```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

## Still Having Issues?

### Debug Checklist

- [ ] Check browser console (F12)
- [ ] Check Vercel function logs
- [ ] Check Stripe Dashboard logs
- [ ] Verify all environment variables
- [ ] Try incognito mode
- [ ] Try different browser
- [ ] Clear cache and cookies
- [ ] Restart dev server
- [ ] Delete `.next` folder and rebuild

### Get Help

1. **GitHub Issues**: Search existing issues or create new one
2. **Vercel Support**: For deployment issues
3. **Stripe Support**: For payment issues
4. **Spotify Forum**: For API issues
5. **Stack Overflow**: Tag with `nextjs`, `three.js`, `stripe`

### Create a Good Bug Report

Include:
- Full error message
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, browser, Node version)
- Relevant code snippets
- Screenshots/videos if applicable

---

**Pro tip**: Most issues are due to:
1. Missing environment variables
2. Incorrect API URLs/callbacks
3. Browser compatibility
4. Forgetting to restart dev server

Check these first! 🔍




