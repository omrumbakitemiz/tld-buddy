# TLD Buddy: code review

Reviewed at `0c979de` (main, "Redis 8") on 2026-10-28, before the `refactor/ui-ux-overhaul` branch. Covers `app/`, `server/`, `nuxt.config.ts`, `Dockerfile`, `docker-compose.yml`, `deploy.sh`.

Status column: **Fixed** = fixed on this branch, **Open** = still to do, with a recommendation.

## Summary

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Data sync | Last-write-wins whole-document PUT: two devices silently overwrite each other | High | Fixed |
| 2 | Data sync | Edits made in the 500 ms debounce window are lost when the tab closes; unsynced local edits are discarded on next load | High | Fixed |
| 3 | Data safety | No server-side validation and no backups: one bad PUT replaces everything | High | Fixed |
| 4 | Data safety | Redis runs with default RDB snapshots only: a Pi power cut can lose up to an hour | Medium | Open |
| 5 | Security | Session token is deterministic HMAC(password, password): never expires, cannot be revoked, and allows offline password guessing | High | Fixed |
| 6 | Security | No login rate limit; password comparison not constant-time | Medium | Fixed |
| 7 | Security | Direct LAN/tailnet port 4000 bypasses Cloudflare Access | Medium | Open |
| 8 | Build | `nuxi typecheck` fails: `loadEnv` imported from `vite`, not a direct dependency | Medium | Fixed |
| 9 | Build | `loadEnv` also merged `.env.local` (old Vercel/Upstash values) into dev config | Low | Fixed |
| 10 | Perf | Map pickers loaded 2 MB full maps as thumbnails (~40 MB to open the picker) | Medium | Fixed |
| 11 | Perf | No cache headers on 95 MB of static maps/icons | Medium | Fixed |
| 12 | Perf | Full map image decoded at 4k×4.6k (~75 MB RAM) on every device | Low | Open |
| 13 | Perf | All markers rebuilt on any change; O(n) item lookups in render loops | Low | Fixed |
| 14 | Bugs | `stash-${Date.now()}` ids collide on fast double-add | Low | Fixed |
| 15 | Bugs | Leaflet map not resized when its container changes size | Low | Fixed |
| 16 | Bugs | Module-level `/api/data` fetch fires before the auth check (racy 401 path) | Low | Fixed |
| 17 | a11y | Hover-only edit/delete buttons, invisible on touch; icon buttons without names; clickable divs | Medium | Fixed |
| 18 | Structure | 580-line `useGameData` mixing static data, persistence, sync and domain logic | Medium | Fixed |

## Data sync and races

**1. Last-write-wins across devices (fixed).** `PUT /api/data` replaced the whole `app-data` key with whatever the client sent. With the PC and the phone both open, each device saved its full copy. The second save erased whatever the first device had added since its last load: markers, loot state, stashes. The earlier "Fix auth/data sync races" commit stopped an *empty* client from wiping Redis, but not two *valid* clients overwriting each other.

Fix: the server stores a revision (`app-data:rev`). Clients send `X-Base-Rev`. A Lua script does an atomic compare-and-set, and a stale write gets `409` with the current document. The client then runs a three-way merge (`shared/utils/appData.ts → mergeAppData`) of base (the last agreed version), local and remote:
- Records (runs, markers, stashes, pins) are matched by id.
- When both sides changed the same record, fields are merged and the local value wins only for fields it changed.
- Deleted on one side but edited on the other: the edit survives.
- Enabled POIs and recent maps merge as sets.

Verified locally: another client added a marker and edited a note, this tab then marked loot on a stale revision, and both changes ended up in Redis.

**2. Lost edits on close / reload (fixed).** Saves were debounced by 500 ms with no flush, so closing the tab or switching apps on a phone right after a change dropped it from the server. The next load then let the API copy overwrite the local cache, so the change was gone everywhere. Now pending edits are flushed on `pagehide` / `visibilitychange` (with `keepalive`). Unsynced edits are kept in localStorage with their base revision (`tld-buddy-sync-v1`) and merged into the server copy on the next load instead of being thrown away. Network failures retry with backoff, and the top bar shows Saved / Saving / Offline / Not saved.

**3. No validation, no backups (fixed).** Any JSON body was written as-is, including `null` or `{}`. PUT now rejects anything that is not an AppData document (`400`) and caps the size at 5 MB. Each write first copies the previous document to `app-data:backups` (at most every 10 minutes, newest 50 kept, format `"<epoch-ms>:<rev>\n<json>"`).

To roll back: `docker compose exec redis redis-cli LRANGE app-data:backups 0 5`, pick an entry, then `SET app-data '<json part>'` and `INCR app-data:rev`.

**4. Redis durability (open).** `redis:8-alpine` in compose uses the default RDB snapshot policy (the first save comes up to an hour after a single change). On a Raspberry Pi a power cut is the realistic failure. Recommendation: turn on AOF. **Do this at runtime first**, so Redis rewrites the AOF from the live dataset. Starting a container with `--appendonly yes` against an existing RDB-only volume risks loading an empty dataset on some versions:
```bash
docker compose exec redis redis-cli CONFIG SET appendonly yes
docker compose exec redis redis-cli INFO persistence | grep aof_rewrite_in_progress   # wait for 0
```
Then add `command: ["redis-server", "--appendonly", "yes"]` to the `redis` service in `docker-compose.yml`. Not changed on this branch, because the production volume holds the only copy of the data.

## Security

The app is now public at https://tld.immino.dev behind Cloudflare Access, plus the LAN port and the tsdproxy/tailnet name.

**5. Session token (fixed).** The token was `HMAC_SHA256(key=password, "tld-buddy:"+password)`. That made it the same value for every login, forever. Logout only deleted the browser's cookie; the token stayed valid until the password changed. Anyone holding a cookie could also brute-force the password offline. Tokens are now `issuedAt.signature`, signed with a random 32-byte secret stored in Redis (`auth:session-secret`, overridable with `NUXT_SESSION_SECRET`). They are bound to the current password and expire after 30 days. `redis-cli DEL auth:session-secret` signs every device out. **Deploying this signs everyone out once.**

**6. Brute force (fixed).** Login now allows 10 failures per 10 minutes per client, then returns `429`. The client key is `cf-connecting-ip` when present, otherwise the socket address. Password checks use `timingSafeEqual` on hashes. Caveat: through tsdproxy all requests share one socket address, so on the tailnet the limit is effectively global.

**7. Cloudflare Access bypass (open).** Port 4000 on the Pi and the tsdproxy hostname reach the app without Access, so the shared password is the only gate there. Recommendations:
- Bind the port to localhost or the LAN interface (`127.0.0.1:4000:3000`) if only the tunnel needs it.
- Or, in the app, verify the `Cf-Access-Jwt-Assertion` header for requests arriving through the tunnel.

Also keep `COOKIE_SECURE=true` for the public hostname (HTTPS). The current `.env.example` default of `false` suits the LAN only.

Other notes (no change needed): `sameSite=lax` plus JSON PUT/POST blocks the realistic CSRF paths. Marker and POI names are HTML-escaped before going into Leaflet `divIcon` HTML. The static data JSON is trusted.

## Build and configuration

**8/9. `vite` import (fixed).** `nuxt.config.ts` imported `loadEnv` from `vite`, which pnpm does not hoist (`TS2307`). It also baked `APP_PASSWORD` into the build-time config, and in dev it merged `.env.local`, which still holds the old Vercel/Upstash `REDIS_URL`. Removed: `runtimeConfig` now has empty defaults filled at runtime by `NUXT_APP_PASSWORD` / `NUXT_REDIS_URL` (compose already sets these). `nuxt dev` loads `.env` natively, and `server/utils/config.ts` falls back to `APP_PASSWORD` / `REDIS_URL`. `COOKIE_SECURE` is read at runtime, unchanged. `.env.local` is no longer read; it can be deleted.

Dockerfile / compose / deploy.sh are fine for the homelab. Minor notes:
- The image runs as root. `USER node` would be easy to add.
- `deploy.sh` prunes images but never checks app health; `docker compose ps` gives no health signal for `app`. A `healthcheck` hitting `/api/auth/check` would help.

## Performance

**10. Thumbnails (fixed).** `public/maps/thumbs/` holds 360px previews (~30 KB each, 1.2 MB total). Regenerate with `scripts/make-map-thumbs.sh`.

**11. Caching (fixed).** `routeRules` now send `Cache-Control: public, max-age=604800, stale-while-revalidate` on `/maps/**` and `/items/**`, `no-cache` (ETag revalidation) on `/data/**`, and `no-store` on `/api/**`. Cloudflare can now cache the maps too. Verified with `curl -I`.

**12. Big map images (open).** Each region is one 2 MB JPEG of about 4235×4650 px, decoded at full resolution. That is fine on desktop and heavy on older phones. A proper fix is a tile pyramid (e.g. `vips dzsave` → `L.tileLayer`) or a lower-resolution variant for small screens. Deferred: it needs a build-step decision.

**13. Marker rendering (fixed).** Markers and POI labels were cleared and rebuilt on every deep change. They are now diffed by a per-marker key, so only changed markers are replaced. Item, map and POI lookups use `Map` indexes instead of `Array.find` in loops. Marker counts per map per run are small, so Leaflet DOM markers stay the right tool. Canvas or clustering only becomes worth it in the thousands.

## Bugs

- **14.** `stash-${Date.now()}` and `run-${Date.now()}` ids could collide. Now `createId()` adds a random suffix, and adding the same item to a stash stacks the quantity.
- **15.** No `invalidateSize()` when the map container changes size. `useImageMap` now uses a `ResizeObserver`; this matters with a collapsible panel.
- **16.** `useGameData` fetched `/api/data` at module import, before the auth check, then again after it. Loading now runs only after a confirmed session (`useAuth`).
- Map `fitBounds` was the only zoom limit, so you could pan into the void. The map now has `maxBounds` and a minimum zoom.
- Leaflet popups were built from HTML strings with `onclick` wiring. They are replaced by a Vue selection card, which is reachable by keyboard.

## Accessibility

Before: edit/delete buttons in lists were `opacity-0 group-hover:opacity-100`, invisible and practically unusable on touch. Icon-only buttons relied on tooltips with no accessible name. POI rows in settings were clickable `div`s, map markers had no names, and touch targets were 20–28 px. All of these are addressed on this branch:
- named buttons and `role`/`aria-*` on toggles, tabs and radios
- markers labelled "Flare ×2 (looted)"
- 40 px targets on touch
- visible focus rings
- `prefers-reduced-motion` respected
- every action reachable by keyboard (`?` lists the shortcuts)

## Code structure

`useGameData.ts` (580 lines) held module-level state, localStorage, API sync, static data loading and every domain operation. It is now split:

| Module | Responsibility |
|--------|----------------|
| `shared/types/game.ts` | Data models (client + server) |
| `shared/utils/appData.ts` | Defaults, `normalizeAppData` (the migration point), `mergeAppData`, `createId` |
| `app/composables/useAppStore.ts` | User document, local cache, revision sync, conflict merge |
| `app/composables/useStaticData.ts` | Static JSON + indexes |
| `app/composables/useGameData.ts` | Domain operations (runs, markers, POIs, stashes, travel) |
| `app/composables/useAuth.ts` | Session check/login/logout |
| `app/composables/useUiState.ts` | Per-device UI state (panel, selection, placement) |
| `app/composables/useImageMap.ts` | Shared Leaflet setup (main map + travel panes) |
| `server/utils/appDataStore.ts` | Redis CAS + backups |

Dead code removed: `ItemManager` (no item in `items.json` has a description; search covers it), `MapSelector`, `MarkerPanel`, `POIPanel` and `RecentMapsSidebar` (replaced by the side panel tabs). The unused card/sheet/badge shadcn primitives remain in `components/ui` for now.

## Redis data format

- `app-data` keeps its exact top-level shape. Markers gain an optional `lootedAt: number | null`; older documents load as "still there". Older builds ignore the field, so rolling back is safe.
- New keys: `app-data:rev`, `app-data:backups`, `app-data:backup-at`, `auth:session-secret`.
- No migration needs to run. `normalizeAppData` reads any older document.
