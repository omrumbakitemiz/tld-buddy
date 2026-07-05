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

The stack builds directly from this repo on the target Pi — no registry, no CI.

### One-time: let the agent Pi build over the tunnel

When the target node is a **Portainer agent** (a different Pi than the one running
Portainer), builds are proxied through the agent tunnel, which breaks BuildKit's
HTTP/2 stream:

```
error reading server preface: http2: frame too large
```

This is a transport limitation, not a hardware or Dockerfile issue. Make that
Pi's Docker use the classic build protocol (tunnels fine). On the **agent Pi**,
set the env var on its portainer-agent container, e.g. in the agent's compose:

```yaml
services:
  agent:
    image: portainer/agent:lts
    environment:
      DOCKER_BUILDKIT: "0"
```

Recreate the agent container. (If you ever deploy onto the Pi that runs Portainer
itself — the "local" environment — this isn't needed; local builds work as-is.)

### Deploy the stack

1. **Stacks → Add stack → Git repository**
2. Repository: `https://github.com/omrumbakitemiz/tld-buddy`
3. Reference: `refs/heads/main`, Compose path: `docker-compose.yml`
4. Pick the target **Pi environment**
5. Set **stack environment variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `APP_PASSWORD` | yes | `my-secret` | Login password |
| `PORT` | no | `3000` | Host port (default 3000) |
| `COOKIE_SECURE` | no | `false` | Set `false` for plain HTTP access |

6. **Deploy** — Portainer clones the repo, builds on the Pi, and starts app + Redis.

To update after pushing to `main`: open the stack → **Pull and redeploy**.

> **Note:** `DOCKER_BUILDKIT=0` is deprecated in Docker CE v28+. If your Pi runs a
> newer Docker that ignores it and the build still fails, build the image once on
> your Mac (`docker buildx build --platform linux/arm64 --push -t <registry>/tld-buddy .`)
> and change `build: .` to `image: <registry>/tld-buddy` so Portainer just pulls.

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
