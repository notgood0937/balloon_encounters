# Balloon Encounters

Real-time interactive social map and [Polymarket](https://polymarket.com) prediction dashboard with drifting balloons.

![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Interactive Social Map** — Share your thoughts on a MapLibre GL globe with drifting balloons, semantic clustering, and regional views
- **3D Balloon Visuals** — Premium 🎈 design with specular highlights, attachment knots, and organic swaying physics
- **Content Previews** — Click any balloon on the map to see its title and a snippet of the message in a glassmorphism bubble
- **AI-Powered Insights** — Semantic matching of balloons, news relevance, and sentiment analysis via Claude API
- **Simulation Mode** — Experiment with balloon publishing and map interaction without needing blockchain credentials
- **Real-Time Data** — Auto-refreshing market data, smart money tracking, and live social drift updates

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **State:** Zustand 5
- **Map:** MapLibre GL JS
- **Charts:** lightweight-charts (TradingView)
- **Database:** SQLite (better-sqlite3)
- **AI:** Claude API (@anthropic-ai/sdk)
- **Styling:** Tailwind CSS 4 + CSS custom properties

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone
git clone https://github.com/AmazingAng/BalloonEncounters.git
cd BalloonEncounters

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_BASE_URL` | Yes | Anthropic API base URL |
| `AI_API_KEY` | Yes | Anthropic API key (for summaries, news matching, sentiment) |
| `AI_FALLBACK_BASE_URL` | No | Fallback API base URL |
| `AI_FALLBACK_API_KEY` | No | Fallback API key (used if primary fails) |

The app works without AI keys — summaries and sentiment will be disabled, but all market data, charts, and trading features remain functional.

## Project Structure

```
src/
├── app/          # Next.js App Router, API routes
├── components/   # 14 panel components + Header, WorldMap, etc.
├── hooks/        # Custom hooks (preferences, watchlist, alerts, drag, resize)
├── lib/          # Data processing, AI clients, news/tweet sources
├── stores/       # Zustand: marketStore, smartMoneyStore, uiStore
└── types/        # TypeScript definitions
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Acknowledgements

Inspired by [WorldMonitor](https://worldmonitor.app/).

## License

[MIT](LICENSE)
