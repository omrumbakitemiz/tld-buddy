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

## Deploy with Portainer (Raspberry Pi homelab)

Raspberry Pis are ARM64 and don't have the RAM to comfortably build a Nuxt app,
and Portainer can't reliably build through agent nodes. So the image is built
**once on your dev machine** (Apple Silicon = same ARM64 arch) and pushed to a
registry. Portainer only pulls it.

### One-time setup

1. Create a GitHub Personal Access Token with `write:packages`.
2. Log in to GHCR on your dev machine:

```bash
echo <YOUR_PAT> | docker login ghcr.io -u omrumbakitemiz --password-stdin
```

### Build & push the image (run whenever you change code)

```bash
pnpm release
```

This builds `linux/arm64` and pushes `ghcr.io/omrumbakitemiz/tld-buddy:latest`.
Make the GHCR package **public** once (GitHub → Packages → tld-buddy → Package
settings → Change visibility) so Portainer can pull without credentials.

### Deploy the stack in Portainer

1. **Stacks → Add stack → Git repository**
2. Repository: `https://github.com/omrumbakitemiz/tld-buddy`
3. Reference: `refs/heads/main`, Compose path: `docker-compose.yml`
4. Pick the **Pi node/environment** you want it on
5. Set **stack environment variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `APP_PASSWORD` | yes | `my-secret` | Login password |
| `PORT` | no | `3000` | Host port (default 3000) |
| `COOKIE_SECURE` | no | `false` | Set `false` for plain HTTP access |
| `TLD_BUDDY_IMAGE` | no | `ghcr.io/omrumbakitemiz/tld-buddy:latest` | Override image/tag |

6. **Deploy** — Portainer pulls the image + starts app + Redis. No build step.

To update: `pnpm release` on your Mac, then **Pull and redeploy** the stack in Portainer.

**HTTPS:** Behind a reverse proxy with TLS (Nginx Proxy Manager, Traefik, Caddy)
leave `COOKIE_SECURE` at the default `true`. Set `COOKIE_SECURE=false` only when
accessing directly over `http://`.

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
