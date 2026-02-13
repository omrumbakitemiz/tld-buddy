# TLD Buddy

An interactive map companion app for **The Long Dark**. Browse regions, track loot across multiple runs, pin Points of Interest, and manage item stashes -- all on high-quality community maps.

## Tech Stack

- **Nuxt 4** / Vue 3 / TypeScript
- **Leaflet.js** for interactive map rendering
- **shadcn-vue** + Tailwind CSS 4 for UI
- **Upstash Redis** (via Vercel Marketplace) for persistent data storage
- Static game data (items, maps, POIs) served from Vercel CDN

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

For API routes to work locally, pull Vercel env vars:

```bash
vercel env pull .env.local
```

## Build & Deploy

The app deploys to Vercel with the `vercel` Nitro preset. Push to the connected Git repo and Vercel handles the rest.

```bash
npm run build
```

## Data Import Scripts

Game data is imported from The Long Dark wiki and Steam community guides. These only need to be re-run if game content changes significantly:

```bash
npx tsx scripts/import-wiki-items.ts   # Items + icons
npx tsx scripts/import-wiki-pois.ts    # Points of Interest
npx tsx scripts/import-steam-maps.ts   # Region map images
```
