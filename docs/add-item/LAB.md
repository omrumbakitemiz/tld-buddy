# Add-item lab: how to build and run a variant

Branches: `feat/add-item-lab` holds the shared seam; each concept lives on `feat/add-item-<a|b|c|d>` cut from it. Concepts: [CONCEPTS.md](CONCEPTS.md). Research: [RESEARCH.md](RESEARCH.md).

## The seam

| File | What it gives a variant |
|---|---|
| `app/composables/useAddUi.ts` | `variant` (`?addui=legacy\|a\|b\|c\|d`, kept per device, also in the ⋮ menu → Add flow), `register({ start, request, interceptClick })`, `pointer` (map position under the mouse), `mapView` (`toClient`, `fromClient`, `reveal`, `container`), `viewTick` (bumps on pan/zoom), `active` (pauses the shell's single-key shortcuts while your UI is open), `hideAddButton`, `announce(text, batchId)` |
| `app/composables/useAddItem.ts` | `addAt(spot, entries, { batchId })` (stacks the same item at the same spot, rings new ones, one undo batch), `undo(batchId?)`, `search(query, { group })`, `frecent(n)`, `groupItems(groupId)`, `likelyItems(poiId)`, `lastItem`, `resolveSpot(pos)` (snaps to a pin or pile within 40 map px), `markersAt(spot)`, `groups` |
| `app/lib/addItem.ts` | the pure functions behind it (`rankItems`, `parseEntry`, `planBatch`, `nearestSpot`, `LOOT_GROUPS`, …), unit-tested in `scripts/test-add-item.ts` |
| `app/components/add/AddUiHost.vue` | mounts `AddUi<X>.vue` inside the map's `<main>` (positioned `relative`, `isolate`) |
| `app/components/add/AddToast.vue` | the shared "Added … · Undo" toast; call `useAddUi().announce()` |

Flow: `A`, the Add loot button, the palette and the panel call your `start(req | null)` (`req.pos` is the pointer's map position when it's over the map). Right-click, long-press, Shift-click and clicks while the legacy placing mode is on call your `request(req)`. Plain map clicks call `interceptClick` first. With no handler registered the shell falls back to the current dialog. `Ctrl+Z` undoes the last batch app-wide.

Rules: a variant edits only its own `app/components/add/AddUi<X>.vue` plus new files under `app/components/add/<x>/`. If it truly needs a seam change, keep it small, generic and mention it in the PR.

## Running it

A throwaway Redis runs on the Pi (`tld-buddy-lab-redis`, Pi-localhost port 6393), tunnelled to `localhost:6393` on this Mac. Use your own DB number and port:

| Variant | Port | Redis URL |
|---|---|---|
| lab / legacy | 3100 | `redis://localhost:6393/0` |
| A | 3101 | `redis://localhost:6393/1` |
| B | 3102 | `redis://localhost:6393/2` |
| C | 3103 | `redis://localhost:6393/3` |
| D | 3104 | `redis://localhost:6393/4` |

```bash
pnpm install
pnpm tsx scripts/seed-lab.ts redis://localhost:6393/<db>     # realistic run: 5 maps, ~210 markers, 42 pins
NUXT_APP_PASSWORD="$(grep ^APP_PASSWORD= ~/dev/tld-map/.env | cut -d= -f2-)" \
  NUXT_REDIS_URL=redis://localhost:6393/<db> COOKIE_SECURE=false pnpm dev --port <port>
# open http://localhost:<port>/?addui=<x>
```

Browser automation: `/tmp/tld-lab-tools/lab.mjs` (playwright-core driving the installed Google Chrome) logs in and opens a variant:

```js
import { open } from '/tmp/tld-lab-tools/lab.mjs'
const { page, browser } = await open({ port: 3101, variant: 'a', width: 1600, height: 1000 })
```

or `node /tmp/tld-lab-tools/lab.mjs <port> <variant> <out.png> [width] [height]` for a quick screenshot.

Never touch the production containers (`tld-buddy-app`, `tld-buddy-redis`), never use port 6379, never deploy.
