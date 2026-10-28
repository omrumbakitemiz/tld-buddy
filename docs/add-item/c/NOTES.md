# C · Rummage: a loot session on a building

Pick it with `?addui=c` or ⋮ → Add flow. Concept: [CONCEPTS.md §C](../CONCEPTS.md#c-rummage-a-loot-session-on-a-building). Screenshots here (1600×1000): `01-idle`, `02-open`, `03-mid-batch`, `04-after`, `05-place-selected` (plain plate click: Places tab + the "Log loot here" chip), `06-compact`.

## How it works

A **session** is one open spot (a pinned place, a pile of markers, or a bare map position) plus a docked panel. Nothing is written until you tick something; every tick writes straight to the run through the seam, and the spot is ringed on the map. **One session = one undo batch** (`addAt(…, { batchId })` for new markers, `amend()` for every edit inside it).

Ways in (plain clicks keep their old meaning everywhere):

| Entry | Result |
|---|---|
| **Right-click** the map, a loot tile or a place plate; **Shift-click**; `A` with the pointer over the map | Session at that spot (snaps to a pinned place or pile; otherwise "Unnamed spot"). Right-click again elsewhere **moves** it |
| Plain click on a plate | Selects the place and opens the Places tab, as before. A **"Log loot here · A"** chip appears under the selected pin |
| `A`, the Add loot button, palette, panel `+` with no pointer on the map | Selected place if there is one, else a "Where did you search?" card: the next plain map click chooses the spot |
| Plain map click while a session is open | Nothing new: it never relocates logging |

Panel (right, 336 px, or 264 px **compact** via the »/« button in its header, remembered): header plate (glacier dot = pinned place, kind, "N logged here, M looted", ↗ Places); search line; the item the keys act on (name, `−` count `+`, "type a number for how many" while armed); the note for the item just ticked; **Likely here** (20 tiles, 8 in compact; frozen when the spot opens; search finds get a tile appended); **On this spot** (every marker there, looted ones washed out, ✓ toggle, name selects the marker); **Done**. The map pans just enough to keep the spot and its plate clear of the panel.

### Undo

- **Inside a session**: `-` / `Delete` / right-click a tile / strip `−` take one unit back from what *this session* put there (newest first, never touching earlier visits; a marker the session made is deleted at zero). `Ctrl+Z` steps back the last thing (digits typed as one number count as one).
- **The whole visit**: leaving a spot (moving it, Done, Esc) toasts "N items logged · place" with **Undo** for the entire session; `Ctrl+Z` after Done does the same. S1's nine items are one step.

## Keyboard model

The search line holds focus whenever a session is open and after mouse actions in the panel; typing anywhere else (map, a tray button) moves it there, and returning from the game (window focus) puts it back.

| Key | Search line empty | Text typed |
|---|---|---|
| letters | start a search | |
| `↵` | one more of the target item (the cursor tile, which carries over to the next spot) | add the highlighted match with the typed quantity / note (`peaches 3`, `3 peaches`, `hacksaw - car trunk`) |
| `Space`, `+`, `=` | same as `↵` | typed (`Space`) |
| `0`–`9` | **only within 4 s after a tick**: set how many of that marker; a number lasts until the first non-digit key | typed into the search |
| `Space` right after such digits | the digits move into the search line and the quantity change is reverted (so `3 pin` is a search) | |
| `-`, `Delete` | take one back | |
| `↑ ↓ ← →` | move the tile cursor (never arms digits) | `↑ ↓` step through matches, `← →` move the caret |
| `Tab` | normal DOM order: note → tray names and ✓ toggles → Done (all focusable; Shift+Tab back). Tiles and the strip buttons are mouse-only (`tabindex -1`, they are driven by the cursor) | same |
| `Esc` | Done (in the note: save, back to search) | clear the search |
| `Ctrl/⌘ Z` | step back the last thing | browser undo |
| `Ctrl/⌘ K` | command palette, unchanged | |

Mouse: tile click = +1, right-click = −1. Buttons in the panel take focus normally; after a pointer click the search line gets the keyboard back, after a keyboard activation focus stays put.

**Paused while a session is open** (`addUi.active`): `A L H N / ? P [ 1 2 3 F + - T R E Del Esc`; `- + = Esc Space` are re-used as above. Wheel zoom and `Ctrl+K` keep working.

## Measured counts

Driven with Playwright against the seeded lab DB (`/tmp/tld-c/*.mjs`, not committed): an expert's frecency, the shortest prefix I'd really type, digits after the Enter.

| | Clicks | Keys | How |
|---|---|---|---|
| S1 keyboard, 9 items (5 with quantity) | 1 (right-click; 0 with `A`, +1 key) | 50 | `mat⏎12 pin⏎3 rifle am⏎2 hat⏎ sew⏎ toq⏎ clo⏎2 firew⏎5 anti⏎` |
| S1 mouse-first | 7 | 25 | right-click, 6 tiles, `12 3 2 5`; search for ammo, hatchet, firewood (unchanged by round 1) |
| S2 stash | 1 | 34 | unchanged flow |
| S3 hacksaw + note | 1 | 24 (6 without the note) | right-click, `hacks⏎`, `Tab`, `in the car trunk`, `⏎` |
| S4 firewood × 5, keyboard | 5 | 10 | right-click, `firew⏎`, then 4 × (right-click the spot, `⏎`) |
| S4 mouse-only | 10 | 0 | 5 × (right-click the spot, tile) |
| S5 three items, then two more after alt-tab | 1 then 0 | 17 then 12 | right-click plate; later focus is waiting in the search line |
| Mistake | 0 | 1–2 | `book⏎` then `-` (or `Ctrl+Z`) |
| Undo S1 entirely | 1 or 0 | 0 or 2 | toast Undo, or `Esc` `Ctrl+Z` |

Data checked through `/api/data`: S1's nine markers sit ≥ 12 map px apart on the seam's concentric ring (the round-1 build put items 7–9 on top of each other); the toast Undo and `Ctrl+Z` after Done restored exactly the starting 211 markers; plain plate click opens no session; right-click on a loot tile and on a plate opens the session at that spot.

## Round-1 fixes, per critique item

1. **Digits swallowed.** Digits are a quantity only while *armed*: right after a tick/Enter/stack, for 4 s, cleared by any search typing, arrow move, new spot, Esc or returning to the window. The cursor item carried to a new spot is never armed, so `3 peaches` there is a search. The 1.2 s inter-digit window is gone (a number ends at the next non-digit). Space after digits reclaims them as a search (`3 pin` right after a tick is still a search).
2. **Undo.** One batch per session; summary toast has Undo for the visit; in-session take-back via `-`, right-click and `Ctrl+Z` (ledger in `c/rummage.ts`, edits through `amend`).
3. **Stray click.** Only right-click / `A` / Shift-click move a session; plain clicks do not. The footer says "Right-click: move here".
4. **Plate click.** Restored to select-place/Places. Sessions come from right-click on a plate (seam) and the "Log loot here" chip on a selected place (also reachable from the Places list).
5. **Screen cost.** Panel 360 → 336 px, plus a compact mode (264 px, 4-column, 8 tiles) that saves 72 px more. Left panel + session: 47 % of 1600 px full, 42 % compact. Closing the left panel (button) gives the rest back.
6. **Keyboard / a11y.** `keepFocus` removed; panel buttons are focusable by mouse. Tab walks search → note (moved right under the strip) → tray → Done. Digits typed with focus on a button still reach the armed item.
7. **Size.** State is an instance (`createRummage`, provided to the panel), not module globals; `adjust`/`planAdjust`, the gesture stacks, tile pop animation and "back to last spot" are gone. Pure parts (`pushDigit`, `moveCursor`, ledger) are tested in `scripts/test-rummage.ts`. Still ~1,150 lines in total (about 430 are CSS and template for the panel and tile).

## Seam use

Uses the lab seam as is: `addAt` with `batchId`, `amend`, right-click on tiles/plates → `request`, `resolveSpot`, `likelyItems`. My own seam additions were dropped: `interceptPOIClick` (replaced by right-click + the chip) and `adjust`/`planAdjust` (`amend` does the same job; I only needed per-marker "units this session" bookkeeping, which lives in the ledger). Kept one generic edit: `mapView.reveal(pos, margin)` also accepts `{ top, right, bottom, left }` so the docked panel reserves only its own side (number still works).

## Objections and known gaps

- **Armed digits stay.** The critique asked that digits only mean quantity right after a tick; that is what they do now, but "type a number right after `Enter`" (S1's `mat⏎12`) is the whole fast path, so a 4 s window remains rather than removing the quantity-by-digit entirely. `peaches 3` and `3 peaches` both work in the search line.
- **Compact is opt-in**, not automatic: at 1600 px the full panel keeps 5 legible columns. Auto-compacting when the left panel is open would be one `computed`; I left it out so the screenshots and counts describe one layout.
- Decrement can't reach units logged before this visit (use the Loot card). A noted marker doesn't stack with later ticks (shared `planBatch` rule).
- Not done: touch UI, a condensed HUD font, windows narrower than ~1100 px.
