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
docker compose up -d --build

# 3. Open http://localhost:3000
```

This starts two containers:
- **app** — the Nuxt server (port 3000)
- **redis** — Redis 7 with a persistent volume for your save data

To stop: `docker compose down`
To stop and wipe data: `docker compose down -v`

## Deploy with Portainer (Git repository)

The stack builds directly from this repo — no SSH, no external registry.

1. **Stacks → Add stack → Git repository**
2. Repository: `https://github.com/omrumbakitemiz/tld-buddy`
3. Reference: `refs/heads/main`, Compose path: `docker-compose.yml`
4. Add a GitHub PAT if the repo is private
5. Set **stack environment variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `APP_PASSWORD` | yes | `my-secret` | Login password |
| `PORT` | no | `3000` | Host port (default 3000) |
| `COOKIE_SECURE` | no | `false` | Set `false` for plain HTTP access |

6. **Deploy the stack** — Portainer clones the repo, builds the app image, and starts app + Redis.

To update after pushing to `main`: open the stack → **Pull and redeploy**.

### If the build fails with `http2: frame too large`

This is a Portainer/BuildKit bug (BuildKit talks HTTP/2 to the daemon; some setups can't). Disable BuildKit on the **Portainer container itself** so it uses the legacy builder over HTTP/1.1:

```yaml
services:
  portainer:
    image: portainer/portainer-ce:lts
    environment:
      DOCKER_BUILDKIT: 0
```

Recreate the Portainer container, then redeploy the stack. This Dockerfile uses no BuildKit-only features, so the legacy builder handles it fine. (If you run a Portainer **agent**, set `DOCKER_BUILDKIT: 0` on the agent container instead.)

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
