# TLD Buddy

An interactive map companion app for **The Long Dark**. Browse regions, track loot across multiple runs, pin Points of Interest, and manage item stashes -- all on high-quality community maps.

## Tech Stack

- **Nuxt 4** / Vue 3 / TypeScript
- **Leaflet.js** for interactive map rendering
- **shadcn-vue** + Tailwind CSS 4 for UI
- **Redis** for persistent user data storage
- Static game data (items, maps, POIs) bundled in the app

## Quick Start (Docker)

```bash
# 1. Set your login password
cp .env.example .env
# edit .env and set APP_PASSWORD

# 2. Build and run (builds locally)
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build

# Or pull the pre-built image from GitHub (after CI has run on main):
# docker compose up -d

# 3. Open http://localhost:3000
```

This starts two containers:
- **app** — the Nuxt server (port 3000)
- **redis** — Redis 7 with a persistent volume for your save data

To stop: `docker compose down`
To stop and wipe data: `docker compose down -v`

## Deploy with Portainer (GitHub)

Portainer **cannot build images** from compose files reliably (BuildKit / agent proxy errors). This repo publishes a pre-built image via GitHub Actions instead.

1. Wait for the **Publish Docker image** workflow to finish on `main` (Actions tab on GitHub).
2. **Stacks → Add stack → Git repository**
3. Repository: `https://github.com/omrumbakitemiz/tld-buddy`
4. Compose path: `docker-compose.yml`, branch: `main`
5. Add a GitHub PAT if the repo is private (Portainer → Settings)
6. If the GHCR package is private, add registry **ghcr.io** in Portainer (username + GitHub PAT with `read:packages`).
7. Set **stack environment variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `APP_PASSWORD` | yes | `my-secret` | Login password |
| `PORT` | no | `3000` | Host port (default 3000) |
| `COOKIE_SECURE` | no | `false` | Set `false` for plain HTTP access |
| `TLD_BUDDY_IMAGE` | no | `ghcr.io/omrumbakitemiz/tld-buddy:latest` | Override image tag |

8. Deploy the stack — Portainer **pulls** the image (no build step).

To update after a push to `main`: wait for the GitHub Action, then **Pull and redeploy** the stack.

**Make GHCR public (optional):** GitHub → Packages → `tld-buddy` → Package settings → Change visibility to public, so Portainer can pull without registry credentials.

**HTTPS:** If you put the app behind a reverse proxy with TLS (Nginx Proxy Manager, Traefik, Caddy), leave `COOKIE_SECURE` at the default `true`. Only set `COOKIE_SECURE=false` when accessing directly over `http://`.

## Local Development

Requires a running Redis instance (or use Docker Compose for just Redis):

```bash
# Start Redis only
docker compose up redis -d

# Install deps and run dev server
pnpm install
cp .env.example .env.local
# set APP_PASSWORD and REDIS_URL=redis://localhost:6379
pnpm dev
```

## Data Import Scripts

Game data is imported from The Long Dark wiki and Steam community guides. Re-run only when game content changes:

```bash
pnpm exec tsx scripts/import-wiki-items.ts   # Items + icons
pnpm exec tsx scripts/import-wiki-pois.ts    # Points of Interest
pnpm exec tsx scripts/import-steam-maps.ts   # Region map images
```
