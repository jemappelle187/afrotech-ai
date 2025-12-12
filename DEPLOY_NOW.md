# 🚀 Quick Deploy Guide - afrotech.ai

## Option 1: Import via Vercel Dashboard (Easiest)

1. **Go to Vercel Dashboard**: https://vercel.com/new
2. **Click "Import Project"**
3. **Choose one of these options:**

   **If you have a Git repository:**
   - Connect your GitHub/GitLab/Bitbucket account
   - Select the repository containing this code
   - Vercel will auto-detect Next.js settings

   **If you don't have a Git repo yet:**
   - Click "Deploy" → "Browse" 
   - Or use the Vercel CLI (see Option 2 below)

4. **Configure the project:**
   - Project Name: `afrotech-ai` (or keep default)
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

5. **Add Environment Variables** (Critical!):
   Go to Project Settings → Environment Variables and add:
   
   ```
   # Auth
   NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
   NEXTAUTH_URL=https://afrotech.ai
   
   # Spotify
   SPOTIFY_CLIENT_ID=<your-client-id>
   SPOTIFY_CLIENT_SECRET=<your-secret>
   SPOTIFY_REDIRECT_URI=https://afrotech.ai/api/auth/callback/spotify
   
   # Stripe
   STRIPE_SECRET_KEY=<your-secret-key>
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-publishable-key>
   STRIPE_WEBHOOK_SECRET=<your-webhook-secret>
   
   # Database
   POSTGRES_URL=<your-postgres-connection-string>
   
   # SoundCloud (for AI DJ)
   SOUNDCLOUD_CLIENT_ID=<your-client-id>
   SOUNDCLOUD_CLIENT_SECRET=<your-secret>
   
   # YouTube (for AI DJ)
   YOUTUBE_API_KEY=<your-api-key>
   
   # Feature Flags
   NEXT_PUBLIC_AI_DJ_ENABLED=1
   ```

6. **Deploy!**
   - Click "Deploy"
   - Wait for build to complete
   - Your site will be live!

## Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if npm permissions are fixed):
   ```bash
   npm install -g vercel
   # OR use npx (no install needed):
   npx vercel
   ```

2. **Login to Vercel**:
   ```bash
   npx vercel login
   ```

3. **Link and Deploy**:
   ```bash
   cd /Users/emmanuelyeboah/Projects/afrotech.ai
   npx vercel link
   # Follow prompts to select/create project
   
   npx vercel --prod
   ```

## Option 3: Connect Git Repository (Recommended for Auto-Deploy)

1. **Push code to GitHub/GitLab/Bitbucket**:
   ```bash
   # If you have a remote:
   git remote add origin <your-repo-url>
   git push -u origin main
   
   # If you need to create a new repo:
   # - Go to GitHub.com → New Repository
   # - Name it "afrotech-ai"
   # - Don't initialize with README
   # - Copy the repo URL
   # - Then run the commands above
   ```

2. **Import in Vercel**:
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your repository
   - Configure as in Option 1
   - Future pushes will auto-deploy!

## Troubleshooting

### If the project already exists but isn't showing:
- Check if you're in the correct team/account
- Look for it under "All Teams" in the dropdown
- Check if it was archived

### If deployment fails:
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify the build works locally: `npm run build`

### Domain Configuration:
- If afrotech.ai is already connected, Vercel should detect it
- Otherwise, go to Project Settings → Domains
- Add `afrotech.ai` and follow DNS instructions

---

**Current Status**: ✅ Build is working locally
**Next Step**: Import/Deploy via one of the options above

