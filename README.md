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

# 2. Build and run
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build

# 3. Open http://localhost:3000
```

This starts two containers:
- **app** — the Nuxt server (port 3000)
- **redis** — Redis 7 with a persistent volume for your save data

To stop: `docker compose down`
To stop and wipe data: `docker compose down -v`

## Deploy with Portainer (GitHub)

Portainer **cannot run `build:` in compose files** (BuildKit errors through the agent). Build the image on the Docker host first, then deploy the stack from Git.

### 1. Build the image on the Docker host (SSH)

```bash
git clone https://github.com/omrumbakitemiz/tld-buddy.git
cd tld-buddy
./scripts/docker-build.sh
```

Or without cloning again on updates:

```bash
cd tld-buddy && git pull && ./scripts/docker-build.sh
```

This tags the image as `tld-buddy:local`.

### 2. Deploy the stack in Portainer

1. **Stacks → Add stack → Git repository**
2. Repository: `https://github.com/omrumbakitemiz/tld-buddy`
3. Compose path: `docker-compose.yml`, branch: `main`
4. Add a GitHub PAT if the repo is private
5. Set **stack environment variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `APP_PASSWORD` | yes | `my-secret` | Login password |
| `PORT` | no | `3000` | Host port (default 3000) |
| `COOKIE_SECURE` | no | `false` | Set `false` for plain HTTP access |

6. Deploy — Portainer starts containers using the **already-built** `tld-buddy:local` image (no build step).

To update: rebuild on the host (`git pull && ./scripts/docker-build.sh`), then **Pull and redeploy** the stack in Portainer.

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
