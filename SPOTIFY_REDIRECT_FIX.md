# 🔧 Fix: Spotify "INVALID_CLIENT: Insecure redirect URI" Error

## Problem
Spotify is rejecting the redirect URI because `http://localhost:3000/api/auth/callback/spotify` is not registered in your Spotify app settings.

## Solution: Add Localhost Redirect URI to Spotify

### Step 1: Go to Spotify Developer Dashboard
1. Visit: https://developer.spotify.com/dashboard
2. Click on your app (the one with Client ID: `4935b105ab434aa59ab386711e80a918`)

### Step 2: Add Redirect URIs
1. Click **"Edit Settings"** button
2. Scroll down to **"Redirect URIs"** section
3. Click **"Add redirect URI"**
4. Add these TWO redirect URIs:

   **For Development (localhost):**
   ```
   http://localhost:3000/api/auth/callback/spotify
   ```

   **For Production:**
   ```
   https://www.afrotech.ai/api/auth/callback/spotify
   ```

5. Click **"Add"** after each one
6. Click **"Save"** at the bottom

### Step 3: Verify
- You should now see both redirect URIs listed
- The localhost one is for development
- The production one is for your live site

### Step 4: Test
1. Go back to: http://localhost:3000/darkroom
2. Click "Connect Spotify"
3. It should now work without the error!

---

## Why This Happens

Spotify requires all redirect URIs to be explicitly registered in your app settings for security. This prevents unauthorized apps from redirecting to your callback URL.

- **Development**: Use `http://localhost:3000` (HTTP is allowed for localhost)
- **Production**: Use `https://www.afrotech.ai` (must be HTTPS)

---

## Quick Checklist

- [ ] Added `http://localhost:3000/api/auth/callback/spotify` to Spotify app
- [ ] Added `https://www.afrotech.ai/api/auth/callback/spotify` to Spotify app
- [ ] Clicked "Save" in Spotify dashboard
- [ ] Tested the connection on localhost

After adding these, the "Connect Spotify" button should work! 🎵

