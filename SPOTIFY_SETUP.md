# 🎵 Spotify Setup Guide

## Quick Fix for "Connect Spotify" Button

The button is showing `<your-spotify-client-id>` because environment variables aren't set in Vercel yet.

## Step-by-Step Setup

### 1. Get Spotify Credentials

1. Go to: https://developer.spotify.com/dashboard
2. Click on your app (or create a new one)
3. Copy:
   - **Client ID** (visible on the app page)
   - **Client Secret** (click "View client secret" to reveal)

### 2. Add to Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your `afrotech-ai` project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
SPOTIFY_CLIENT_ID=paste-your-actual-client-id-here
SPOTIFY_CLIENT_SECRET=paste-your-actual-client-secret-here
NEXTAUTH_SECRET=GPz8N8JvxzjHxFvsURoJ9Gvn0pi/88FE3NMqGkifbdA=
NEXTAUTH_URL=https://www.afrotech.ai
```

**Important:** 
- Select **Production**, **Preview**, and **Development** for each variable
- Click **Save** after adding each one

### 3. Configure Spotify Redirect URI

1. In Spotify Dashboard → Your App → **Settings**
2. Scroll to **Redirect URIs**
3. Click **Add redirect URI**
4. Add: `https://www.afrotech.ai/api/auth/callback/spotify`
5. Click **Add**
6. Click **Save** at the bottom

### 4. Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

### 5. Test

1. Visit: https://www.afrotech.ai/darkroom
2. Click **Connect Spotify**
3. You should see the Spotify login page (not the placeholder)
4. After login, you should see your playlists

## Troubleshooting

### Still seeing `<your-spotify-client-id>`?

- ✅ Check environment variables are set for **all environments** (Production, Preview, Development)
- ✅ Make sure you **redeployed** after adding variables
- ✅ Clear browser cache and try again

### "Invalid redirect URI" error?

- ✅ Make sure the redirect URI in Spotify Dashboard exactly matches:
  `https://www.afrotech.ai/api/auth/callback/spotify`
- ✅ No trailing slashes
- ✅ Must be HTTPS (not HTTP)

### "Invalid client" error?

- ✅ Double-check your Client ID and Secret are correct
- ✅ Make sure there are no extra spaces when pasting

---

**Once this is set up, users will be able to:**
- ✅ Connect their Spotify account
- ✅ See their playlists
- ✅ Play music in the Darkroom
- ✅ Use AI DJ features

