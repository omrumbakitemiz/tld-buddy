# C · Rummage: a loot session on a building

Pick it with `?addui=c` or ⋮ → Add flow. Concept: [CONCEPTS.md §C](../CONCEPTS.md#c-rummage-a-loot-session-on-a-building). Screenshots in this folder: `01-idle`, `02-open`, `03-mid-batch`, `04-after` (1600×1000).

## How it works

A **session** is one open spot (a pinned place, a pile of markers, or a bare map position) plus a docked panel. Nothing is written until you tick something; every tick writes straight to the run through the shared seam, so the map, the Loot tab and the sync indicator update as you go. The spot is drawn as an apricot ring on the map.

Opening a spot:

| Entry | Result |
|---|---|
| Click a **place plate** | Session on that place (the Places tab no longer opens on a plate click; the header's ↗ button, or `2`, still gets there) |
| `A` with the pointer over the map, right-click, Shift-click | Session at the pointer; snaps to a pinned place or pile within 40 map px, otherwise an "Unnamed spot" |
| `A`, the Add loot button, palette or panel `+` with no pointer on the map | Selected place if there is one, else a "Where did you search?" card (next map click chooses; offers "Back to <last spot>") |
| Any map click or plate click **while open** | Moves the session. The cursor item stays, so "same item, next spot" is one key |

The panel (right side, 360 px, left of the zoom buttons so they stay reachable; the map pans just enough to keep the spot clear of it):

1. **Header**: place plate (glacier dot = pinned place), kind, "N logged here, M looted", ↗ to Places.
2. **Search line**: always focused; the whole keyboard goes through it. Grammar: `peaches 3` (quantity after the name), `hacksaw - car trunk` (note after ` - `), diacritic-folded, prefix-first, frecency-ranked (the shared `rankItems`).
3. **The item the keys act on** (fixed height strip): name, `−` / count / `+`. Count is what is on the map at this spot.
4. **Likely here**: 20 tiles (5 × 4): this run's top-6 habits first, then the place kind's list (residential, industrial, cave, …) from the seam's `likelyItems`. **Frozen when the spot opens**, so tiles never reshuffle under the pointer. Items found by search get a tile appended. Tiles look like the markers they create: an apricot ring and quantity pill once on the map, a mint tick if only looted units are there. While typing the grid becomes **Matches**, top match marked `↵`.
5. **On this spot**: every marker at the spot, looted ones last and washed out, each with a looted toggle (mint). Click a name to select that marker on the map (Loot card: edit, delete).
6. **Footer**: a note for the item you just ticked, key hints, **Done** (the one apricot button).

### Undo model

One **gesture** = consecutive ticks and digits on one item = one undo batch. `Ctrl+Z` steps back one gesture (works from the empty search line; with text typed it stays the browser's own undo). `−` / right-click take back units from the newest gestures of that item, never below what earlier sessions logged, and delete a marker the session created once it hits zero. Leaving a spot or pressing Done toasts a summary ("8 items logged · Lake Cabins"); per-tick toasts were dropped because the panel already shows each add and they stacked on each other.

## Keyboard model

The search line has focus whenever the session is open and after every mouse action in the panel; typing anywhere else (map, a tray button) moves focus to it. Returning from the game (window focus) puts it back.

| Key | Search line empty | Text typed |
|---|---|---|
| letters | start a search | |
| `↵` | one more of the cursor item (Enter again = +1 again) | add the highlighted match with the typed quantity / note |
| `Space`, `+`, `=` | same as `↵` | typed as text (`Space`) |
| `0`–`9` | set how many of the item just ticked (digits within 1.2 s are one number: `1` `2` → 12); on an item you only arrowed to, add that many | typed into the search (`peaches 3`) |
| `-`, `Delete` | take one back | |
| `↑ ↓ ← →` | move the tile cursor (stops at the edges) | `↑ ↓` step through matches, `← →` move the caret |
| `Tab` | focus the note for the item just ticked (`Enter` / `Esc` saves and returns) | same |
| `Esc` | Done | clear the search |
| `Ctrl/⌘ Z` | undo the last gesture | browser undo |
| `Ctrl/⌘ K` | command palette (unchanged) | |

Mouse: click a tile = +1, right-click = −1, strip `−` `+`, tray ✓ = looted, **Done**.

**Shortcuts deliberately paused while a session is open** (`addUi.active`): `A L H N / ? P [ 1 2 3 F + - T R E Del Esc`. They would type into the search line otherwise. `-`, `+`, `=`, `Esc` and `Space` are re-used as above; scroll-wheel zoom and `Ctrl+K` keep working. Without a session everything is as before.

## Measured counts

Driven with Playwright (`/tmp/tld-c/*.mjs`, not committed) on the seeded lab data: an expert's frecency, the shortest prefix I'd really type, and the digit key after the Enter. "Click" = mouse press, "key" = keystroke.

| | Clicks | Keys | How |
|---|---|---|---|
| S1 keyboard (9 items, 5 with quantity) | 1 (plate; or 0 clicks and 1 more key with `A` over the place) | 50 | `mat⏎12 pin⏎3 rifle am⏎2 hat⏎ sew⏎ toq⏎ clo⏎2 firew⏎5 anti⏎` |
| S1 mouse-first | 7 (right-click + 6 tiles) | 25 | tiles for matches, peaches, sewing kit, toque, cloth, antiseptic + `12` `3` `2` `5`; search for ammo, hatchet, firewood |
| S2 stash (4 items) | 1 | 34 | `rifle am⏎20 hunting r⏎ pin⏎6 firew⏎10`; "hunt" alone resolves to Hunting Knife |
| S3 rare item + note | 1 | 24 (6 without the note) | right-click, `hacks⏎`, `Tab`, `in the car trunk`, `⏎` |
| S4 firewood × 5 spots, keyboard | 5 | 10 | right-click, `firew⏎`, then 4 × (click the spot, `⏎`) |
| S4 mouse-only | 10 | 0 | 5 × (click the spot, click the tile) |
| S5 container, 3 items now | 1 | 17 | plate click, `pain⏎2 band⏎3 anti⏎` |
| S5 two more after alt-tab | 0 | 12 | focus returns to the search line: `clo⏎2 wool s⏎` (2 clicks if the tiles are in the grid) |

Verified on the map: same item at a spot stacks (Wood Matches 7 + 12 → 19; Antiseptic 1 + 1 → 2), new items land on the ring, markers group with a count badge at low zoom, the ring follows pan/zoom, and `Ctrl+Z` removes gestures one at a time.

## Seam changes (all small, generic, additive)

- `useAddUi.ts` / `InteractiveMap.vue`: **`interceptPOIClick(poiId, e)`** handler hook; a place-plate click calls it before opening the Places tab, return `true` to swallow. Needed so a plate click can open a session.
- `useAddUi.ts` / `InteractiveMap.vue`: **`mapView.reveal(pos, margin)`** now also takes `{ top, right, bottom, left }` (a number still works), so a docked panel can reserve only its own side.
- `useAddItem.ts` + `lib/addItem.ts`: **`adjust(markerId, delta, { batchId })`** with the pure `planAdjust`: change a quantity inside an open batch so Undo still reverses exactly what the batch did (extra units are recorded; removal only takes back what the batch added). Returns `null` when the batch was undone. Unit-tested.

No change to the `app-data` shape; `?addui=legacy` is unchanged (checked: `A` placing hint and right-click dialog still work).

New files: `app/components/add/c/{useRummage.ts, rummage.ts, RummagePanel.vue, RummageTile.vue}`; `AddUiC.vue` registers handlers, draws the ring and owns the capture-phase keys (Ctrl+Z, Esc, type-anywhere). Pure logic (`pushDigit`, `moveCursor`, `planAdjust`) is tested in `scripts/test-add-item.ts`.

## Known gaps

- No way into a session from a marker tile: Leaflet markers swallow right-click, and the Loot card has no "add here". `A` with the pointer next to the tile, or the plate, works.
- A plate click now opens a session instead of the Places tab (stash UI is one `2` away). If that costs too much for stash users, gate it on a modifier or on the loot-tab being active.
- Note belongs to one marker. A noted marker doesn't stack with later ticks (shared `planBatch` rule), so ticking the same item again after a note makes a second marker.
- Likely-item lists are the seam's editorial table; untyped places get the residential mix. No difficulty down-ranking.
- Decrement can't reach units logged before this session; use the Loot card to edit or delete those.
- Not done on purpose: touch UI, a condensed HUD font.
- Not tested: windows narrower than ~1100 px (panel would cover most of the map), screen readers beyond the listbox/combobox wiring.
