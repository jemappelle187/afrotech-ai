# 🚀 Quick Start

Get Afrotech.ai running in 5 minutes.

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Edit .env.local with your API keys
# (See SETUP.md for detailed instructions on getting API keys)

# 4. Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Minimum Required Setup

To run locally without external services:

1. Comment out Postgres queries in API routes (optional - for quick UI testing)
2. Skip Spotify integration (Connect button won't work, but UI will)
3. Skip Stripe integration (Drink buttons won't work, but UI will)
4. Add any MP3 file as `public/sample-mix.mp3`

```bash
# Just to see the UI:
npm install
npm run dev
```

## Next Steps

- See `SETUP.md` for complete production setup
- See `README.md` for architecture overview
- See `DATABASE.sql` for database schema

## Project Structure

```
app/
  ├── api/           # Backend API routes
  ├── darkroom/      # Dark Room page
  ├── beach/         # Beach page
  └── page.tsx       # Landing page

components/         # React components
lib/               # Utilities
public/            # Static files
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Need Help?

See `SETUP.md` for detailed setup instructions and troubleshooting.

Built with Next.js 14, Three.js, Spotify, and Stripe.



