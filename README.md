# TLD Buddy

An interactive map companion app for **The Long Dark**. Browse regions, track loot across multiple runs, pin Points of Interest, and manage item stashes -- all on high-quality community maps.

## Tech Stack

- **Nuxt 4** / Vue 3 / TypeScript
- **Leaflet.js** for interactive map rendering
- **shadcn-vue** + Tailwind CSS 4 for UI
- **Redis** for persistent user data storage
- Static game data (items, maps, POIs) bundled in the app

## Deploy on Raspberry Pi (recommended)

Runs app + Redis on the Pi with a single compose file. Portainer can still
monitor the containers on that node.

### First-time setup (on the Pi)

```bash
git clone https://github.com/omrumbakitemiz/tld-buddy.git
cd tld-buddy
cp .env.example .env
# edit .env — set APP_PASSWORD (COOKIE_SECURE=false is already set for HTTP)
chmod +x deploy.sh
./deploy.sh
```

Open `http://<pi-ip>:4000`.

### Update with new code

After you push to `main` on GitHub, SSH to the Pi and run:

```bash
cd tld-buddy
./deploy.sh
```

That script:
1. `git fetch` + `git pull --ff-only` from `main`
2. `docker compose up -d --build`
3. Prunes unused images

To use another branch: `DEPLOY_BRANCH=my-branch ./deploy.sh`

### Manual docker compose

```bash
docker compose up -d --build   # start / rebuild
docker compose ps              # status
docker compose logs -f app     # logs
docker compose down            # stop (keeps Redis data)
docker compose down -v         # stop and wipe Redis data
```

**HTTPS:** Behind a reverse proxy with TLS (e.g. the Cloudflare hostname), set `COOKIE_SECURE=true` in `.env`.
Optional: `NUXT_SESSION_SECRET` pins the session-signing secret; otherwise one is generated and kept in Redis.
For plain `http://` homelab access, keep `COOKIE_SECURE=false`.

## Local Development

Requires a running Redis instance (or use Docker Compose for just Redis):

```bash
# Start Redis only
docker compose up redis -d

# Install deps and run dev server
pnpm install
cp .env.example .env
# set APP_PASSWORD and REDIS_URL=redis://localhost:6379 (nuxt dev loads .env)
pnpm dev
```

`pnpm exec nuxi typecheck` and `pnpm build` should both pass before deploying.

## Using it

- **Add loot:** press `A` and click the map, or Shift-click / right-click (long-press on touch).
- **Mark looted:** the ✓ next to an item in the Loot tab, or select a marker and press `L`. Looted
  items fade out on the map; `H` hides them.
- **Search anything:** `/` or `Ctrl K`. Press `?` for all shortcuts.
- **Places:** track a region's places, pin them on the map, and stash items there (per run).

## Data and sync

All user data is one JSON document in Redis (`app-data`) with a revision counter (`app-data:rev`).
Every device saves against the revision it last saw. If another device saved in between, the app
merges both sets of changes instead of overwriting them. Edits made while offline are kept on the
device and sent when the server is back. The previous document is kept in `app-data:backups`
(about every 10 minutes, last 50). See `docs/REVIEW.md` for how to restore one.

Design notes: `docs/DESIGN.md`. Review findings: `docs/REVIEW.md`.

## Data Import Scripts

Game data is imported from The Long Dark wiki and Steam community guides. Re-run only when game content changes:

```bash
pnpm exec tsx scripts/import-wiki-items.ts   # Items + icons
pnpm exec tsx scripts/import-wiki-pois.ts    # Points of Interest
pnpm exec tsx scripts/import-steam-maps.ts   # Region map images
./scripts/make-map-thumbs.sh                 # Map previews (macOS sips)
```
