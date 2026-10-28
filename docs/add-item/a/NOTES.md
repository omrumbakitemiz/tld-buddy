# Variant A: Wheel

The game's radial menu, opened on the map where the pointer is. Pick `?addui=a` (or ⋮ menu → Add flow → A · Wheel). Concept: [CONCEPTS.md § A](../CONCEPTS.md#a-wheel-the-games-radial-menu-at-the-cursor).

| | |
|---|---|
| ![Idle](01-idle.png) | ![Open](02-open.png) |
| `01-idle`: the map before adding | `02-open`: `A` with the pointer over the map: the wheel at the spot |
| ![Mid batch](03-mid-batch.png) | ![After](04-after.png) |
| `03-mid-batch`: 5 items in, ring 2 (Clothing) open, Wool Toque hovered | `04-after`: S1–S5 logged; the toast offers Undo |

More: `s3-search.png` (typing "hack"), `s3-note.png` (note on the last pick), `s5-existing.png` (right-click on an existing pile: "Existing spot · 9 here").

## How it works

- **Open** with `A` or `Space` while the pointer is over the map, or right-click (long-press on touch, Shift-click) anywhere on it. The spot snaps to a pinned place or an existing pile within 40 map px (`resolveSpot`), so a second visit to a building joins its pile instead of starting a new ring. With no pointer on the map (the Add loot button, palette, panel) the shell's "Click the map where the loot is" mode comes up and the click opens the wheel.
- **The spot stays visible.** The middle of the wheel is a clear hole with an apricot crosshair. The real marker tile for the spot shows through it and its count goes up as you add. The readout plate sits under the wheel, or over it when there's no room below.
- **Ring 1** has 8 fixed groups, always in the same places: `1 Fire` at 12 o'clock, then clockwise `2 Food`, `3 Drink & aid`, `4 Arms`, `5 Tools`, `6 Clothing`, `7 Materials`, `8 Recent`. Each group has a painted item icon from the game. A bone pill counts what this wheel added from that group. Recent is this run's most-used items; a new run fills it with what the kind of place usually holds.
- **Ring 2** shows the group's items, the most-used first. The order is frozen while the wheel is open so slices don't move under a flick. `9` or **More** shows the next page. An apricot pill on an item means that much of it is still at this spot (same as on the marker).
- **Picking adds right away** (qty 1), and the wheel goes back to ring 1 for the next item. Each add is a real marker you can see, so nothing is lost if you alt-tab away and leave the wheel open. One open wheel is one undo batch.
- **Quantity** goes to the last pick: `Shift`+digits (`⇧1 2` = 12, let go of Shift to start a new number), numpad digits, `+`/`−`, the − / + buttons, or the mouse wheel over the wheel (one notch = one). The plate shows `×12` in the loot pill.
- **Search:** typing any letter turns the wheel into a search. The ring shows the top 8 results over all 667 items (accents folded, prefix first, this run's habits). `1`–`8` or a click picks one; `Enter` takes the top one.
- **Note:** `Tab` opens a note for the last pick ("in the car trunk"). `Enter` saves it and closes, `Tab` saves it and goes back to the wheel. If that pick had stacked onto older loot, it gets its own marker with the note (notes never stack).
- **Same again:** `Space` (or the Again button) adds one more of the last item. With nothing picked yet, that's the last item from your previous add.
- **Closing:** `Enter`, **Done**, `Esc` from ring 1, or a click (not a drag) anywhere outside. You can drag and zoom the map with the wheel open and the wheel stays on its spot. Closing shows the shared toast "Added Wood Matches ×12, Pinnacle Peaches ×3 and 7 more · Undo".
- **Next spot:** right-click anywhere, the wheel included: the current wheel closes and a new one opens there. Right-clicking inside the hole (the same spot) goes back one level.
- **Edges:** opening near an edge pans the map so the whole ring fits. If the map can't pan far enough (a spot at the painting's border), the ring slides inside and a dashed apricot leader points back to the spot.

## Keyboard model

| Key | While the wheel is closed | Ring 1 (groups) | Ring 2 (a group) | Search | Note |
|---|---|---|---|---|---|
| `A` | open at the pointer (shell) | typed: starts a search | starts a search | typed | typed |
| `Space` | **open at the pointer** (new; only when focus is on the page or the map) | Again: one more of the last item | Again | typed (Again on an empty line) | typed |
| `1`–`8` | shell: panel tabs (1–3) | open that group | add that item | add that result | typed |
| `9` | – | – | next page (More) | – | typed |
| `⇧`+digits, numpad | – | quantity of the last pick | quantity | quantity | typed |
| `+` / `=` / `−` | shell: zoom | last pick ±1 | ±1 | `+` ±1, `−` typed | typed |
| `Backspace` | shell: delete the selected marker | take the last pick back | back to ring 1 | delete a letter, then back | typed |
| `Ctrl/⌘ Z` | undo the last whole wheel (shell) | take the last pick back | same | text undo | text undo |
| `Tab` | – | note for the last pick | note | note | save, back to the wheel |
| `Enter` | – | close | close | add the top result | save and close |
| `Esc` | shell: cancel / deselect | close | back to ring 1 | clear, back | cancel |
| letters | shell shortcuts | start a search | start a search | typed | typed |

Mouse: click a slice to choose, right-click to move the wheel, scroll over the wheel for quantity (before the first pick, scrolling zooms the map as usual), click outside to close.

**Conflicts, on purpose.** While a wheel is open it takes every single key: the shell's `A L H N / ? P [ 1 2 3 F + − T R E Del` are paused (`useAddUi().active`) and become search letters, choices or quantity, and `Esc` steps back. `Ctrl+Z` inside an open wheel takes back one pick instead of the whole last batch. With the wheel closed the only new key is `Space`, which the shell doesn't use. The wheel's keys come from a capture-phase `keydown` listener that calls `preventDefault()`, so the shell skips them.

**Change from the concept: digits never mean two things.** The concept had "digits right after a pick set its quantity". That breaks keyboard flow: after picking Hatchet, the `5` meant for Tools would turn into "Hatchet ×5", so every pick would need a separator key, ×1 picks included. Here plain digits always choose, and quantity is `Shift`+digits. The left hand types both while the right hand stays on the mouse. Mouse users can scroll instead. S1 costs 5 Shift presses where the concept's version needed 8 separators.

## Measured counts (driven in Chrome at 1600×1000, lab Redis DB 1, freshly seeded run)

Counted by `/tmp/tld-a/full.mjs` and `/tmp/tld-a/edge.mjs` while performing each scenario; every marker was checked afterwards in `/api/data`.

| | Clicks | Keys | What was pressed | Result checked |
|---|---|---|---|---|
| **S1** keyboard | 0 | 32 | `A`, 9 × (group digit + item digit), 5 × `⇧`+digits (6 digits), one `9` for a page 2 item, `Enter` | 9 markers at one spot, each on its own ring slot, quantities 12/3/2/1/1/1/2/5/1 |
| **S1** mouse only | 20 | 0 | right-click, 9 × (group + item), Done; quantities by 19 wheel notches | same 9 markers, quantities right |
| **S2** stash | 0 | 18 | `Space`, 4 × 2 digits, `⇧20` `⇧6` `⇧10`, `Enter` | 4 markers, 20/1/6/10 |
| **S3** mouse | 4 | 18 | right-click, Tools, More (Hacksaw was on page 2 for this run), Hacksaw, `Tab`, "in the car trunk", `Enter` | Hacksaw ×1 with the note |
| **S3** search | 0 | 16 | `A`, "hack", `Enter`, `Tab`, "glovebox", `Enter` | Hacksaw with the note |
| **S4** 5 spots | 5 | 7 | spot 1: right-click, `1` + Fir Firewood digit; spots 2–5: right-click + `Space`; `Esc` | 5 firewood markers at 5 spots, ×1 each |
| **S5** two visits | 2 | 15 | right-click the pile, 3 picks, `Enter`; later right-click it again, 2 picks (one `⇧2`), `Enter`; one `9` for a page 2 item | still one pile: Wood Matches 12 → 13 → 15 stacked, 3 new items, no new ring |
| Undo | 0 | 1 | `Ctrl+Z` after closing | the whole second S5 wheel came back out: matches back to 13, bandage gone |
| Take back | 0 | 1 | `Backspace` after a wrong pick | the marker was removed, no trace in the batch |

If Again already holds firewood, S4 takes 5 clicks and 6 keys. For comparison, the current dialog (RESEARCH §5): S1 ≈ 1 click + ~55 keys + 5–20 quantity clicks, S4 = 15 clicks.

Also checked: a drag with the wheel open keeps it open and it moves with the map; a plain click outside closes it; `Space` and `Esc` open and close it; the Add loot button goes to aim mode and the next click opens the wheel; the edge clamp works; `?addui=legacy` still opens the old dialog on right-click.

## Seam changes

1. **`useAddItem().amend(batchId, markerId, quantity)`** (new, `app/composables/useAddItem.ts`). It changes how much an open batch put on one marker and keeps undo exact. For a marker the batch created, the value is the new quantity (0 deletes the marker); for a marker it stacked onto, it is the new amount added (0 takes the stack back). An emptied batch is dropped. The wheel needs this because quantity comes *after* the add and `Backspace` takes a pick back. It's generic: chips in B or −/+ ticks in C need the same thing.
2. **`planBatch` ring slots** (`app/lib/addItem.ts`, new `ringSlot`). Bug fix: the slot angle depended on the batch total, so items added one at a time (any live-add variant) landed almost on top of each other; the 7th–9th S1 items were less than 2 px apart. Slots are now fixed: 6 on the first ring (12 px), 12 on the second (24 px, offset half a step), and so on. A single item on an empty spot still sits exactly on it. Legacy mode is unaffected: it places markers itself in `app.vue`.
3. `package.json` `test` also runs `scripts/test-add-item-a.ts`.

No change to the `app-data` shape: markers are still item + quantity + optional note at x/y per run.

## Files

- `app/components/add/AddUiA.vue`: state, picks/undo, keyboard, pointer, seam handlers.
- `app/components/add/a/WheelRing.vue`: the SVG ring (slices, hole, crosshair, digits, pills).
- `app/components/add/a/WheelReadout.vue`: the plate (place, tally, live line, Again/Done, key hints).
- `app/components/add/a/wheel.ts`: pure geometry, the keyboard model (`readKey`), quantity entry and pick bookkeeping, tested in `scripts/test-add-item-a.ts` (16 tests, plus ring-slot tests for the seam fix).

## Known gaps

- **Digits in search pick results**, so you can't search by number. That hits 62 names, mostly notes and collectibles.
- **Item order inside a group follows this run's habits.** It's frozen per open, but it can shift between opens as habits change, which works against muscle memory. Pinning the order once a run has enough markers would fix that.
- **It covers about 300 px around the spot**, plus a 312×190 plate.
- **Click only.** There's no press-drag-release marking-menu flick yet.
- **The note applies to the last pick only.**
- **Clicking the shared toast's Undo while a wheel is open** closes the wheel first, then undoes the previous batch.
- **Zoomed far in**, the spot's markers spread past the hole and sit under the slices. The tile only fits inside the hole where they group into one tile.
- **The edge leader line** mostly runs under the ring.
- **Space-to-open** only works when focus is on the page or the map, so a focused button keeps its Space.
- **Touch:** long-press opens the wheel and taps work. Nothing touch-specific was built.

## Next

A right-button press-drag-release flick (open, flick to a group, flick to an item, release) for the real marking-menu feel. A pinned item order per run. Showing the pile's existing items in the plate before the first pick (a de-duplication glance for S5).
