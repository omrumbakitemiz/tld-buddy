# Adding items to the map: four concepts

Built on [RESEARCH.md](RESEARCH.md). Art direction: [docs/DESIGN.md](../DESIGN.md) and [/DESIGN.md](../../DESIGN.md) ("Painted Dusk": dusk-ink plates, bone uppercase HUD labels, apricot = loot still there / primary action, colour only for state, no glows, no web fonts, 150–250 ms state motion).

**Scope update (2026-10-28, from the user):** desktop only; **no touch UI work** for now (existing long-press stays, nothing new is built for it), and the user types on a **US keyboard**, not Turkish Q. The touch paragraphs were removed and the key choices below assume US layout.

Assumptions made without a discovery round (the brief was precise):
- Every variant writes ordinary **Markers** (item + quantity + optional note at x/y, per run). No change to the `app-data` shape. POI stashes stay their own feature in the Places tab.
- The spot needs building-level precision only (RESEARCH §2), so concepts may snap to a nearby POI pin or an existing spot.
- The current dialog stays as variant **`legacy`** for comparison.

## What every variant must do (shared invariants)

These come from the friction list in RESEARCH §5 and are provided by the shared seam on `feat-add-item-lab` (see "Shared seam" at the end), so variants differ in interaction, not in plumbing.

1. **The spot stays visible** while adding. No centred modal over the map.
2. **Quantity is one keystroke** (digits).
3. **Same spot, again**: adding a second batch to the same building stacks into that spot (same item + same spot + not looted → quantity goes up) instead of spawning a new ring.
4. **Undo**: every add is one batch; `Ctrl+Z` or the toast's Undo removes it.
5. **Search** ranks exact prefix above fuzzy, frecency (per run) above alphabetical, and folds diacritics (cheap, harmless).
6. **Keys** are US layout; no clashes with the existing shortcuts (`A L H N / ? P [ 1 2 3 F + - T R E Del Esc`) unless the variant deliberately takes one over and says so.
7. **Desktop only**: no new touch UI; the existing long-press entry keeps working and nothing is made worse on small screens.
8. **Tokens only**: dusk-ink plates, bone labels, apricot for the active/primary thing, `prefers-reduced-motion` respected.

## Scenarios (from RESEARCH §4)

- **S1** Farmhouse: 9 items at one spot. 12 matches, 3 peaches, 2 rifle ammo, hatchet, sewing kit, wool toque, 2 cloth, 5 firewood, antiseptic (5 with quantity > 1, 6 extra digit keys).
- **S2** Stash: 20 rifle ammo, rifle, 6 cans, 10 firewood at a base (4 items, 7 digit keys).
- **S3** Rare item + note: "hacksaw, in the car trunk".
- **S4** Same item at 5 spots (firewood along a route).
- **S5** Container in drawers: 3 items now, alt-tab to the game, 2 more at the same spot a minute later.

Counts assume an expert who has used the app for a run (frecency has learned their items) and that a common item becomes the top match after ~3 typed letters. "Click" = mouse button press; "key" = keystroke. Current flow (RESEARCH §5) for reference: S1 ≈ 1 click + ~55 keys + 5–20 quantity clicks; S4 = 15 clicks.

---

## A. Wheel: the game's radial menu, at the cursor

**Thesis.** The Long Dark already teaches its players a radial: hold Space, pick a wheel, pick an item. Put that wheel on the map where the pointer is. Pie slices are large and next to the pointer (Fitts), and with a stable layout experts flick without looking.

**Interaction model.**
- **Open:** right-click the map, or press `Space` / `A` with the pointer over the map (the spot is wherever the pointer is; no extra click). The spot gets an apricot crosshair ring; the wheel draws around it.
- **Ring 1, 8 fixed slices** in a fixed order (never reordered, so muscle memory holds): `1 Fire` (matches, firestriker, firewood, coal, accelerant, lantern fuel…), `2 Food`, `3 Drink & meds`, `4 Arms` (rifle, revolver, bow, arrows, ammo, flare gun), `5 Tools`, `6 Clothing`, `7 Materials` (cloth, scrap, hides, gut, saplings), `8 Recent` (this run's frecency top 8). The groups are curated, not the noisy wiki categories (RESEARCH §1).
- **Ring 2:** the chosen slice fans out to its top 8 items, frecency-ranked inside the group. The 9th position is `More…` → type-to-filter inside that group.
- **Typing any letter** at ring 1 or 2 drops to a search line in the hub (all 667 items, folded, prefix-first).
- **Picking adds immediately** (qty 1) and the wheel stays open on ring 1 for the next item. The hub shows a running tally ("6 items"). **Digits** right after a pick set that item's quantity (`1` `2` → 12). `Backspace` removes the last pick.
- **Close:** `Enter`, `Esc`, or click outside. Each open is one undo batch.
- **Note:** `Tab` in the hub opens a one-line note for the spot.
- **Same again:** the hub's centre button is "Again: <last item>"; `Space` on an open wheel with nothing picked repeats the last item.

**Flows.**

| | Clicks | Keys | How |
|---|---|---|---|
| S1 | 0–1 | ~26 | hover + `A`, then per item slice digit + item digit (18), 6 quantity digits, `Enter`. Mouse-only: 1 + 18 clicks + 6 keys |
| S2 | 0–1 | ~16 | `A`, 4×2 digits, 7 quantity digits, `Enter` |
| S3 | 1 | ~22 | right-click, `5` Tools, hacksaw digit, `Tab`, note, `Enter` |
| S4 | 5 | 10 | 5 × (right-click, `Space` for Again, `Enter`) |
| S5 | 2 | ~10 | right-click on the existing tile → wheel opens *on that spot* (stacks), 3 picks; later again |


**Keyboard model.** `A`/`Space` open, `1`–`8` slices then items, `9` More, letters search, digits quantity (after a pick), `Backspace` undo last pick, `Tab` note, `Enter`/`Esc` close.

**Look.** Dark-ink ring segments with hairline separators and bone uppercase slice labels, the item icons in ring 2, apricot fill on the active slice only, the hub as a 64 px ink disc with the tally in tabular numerals. Opens in 160 ms (scale .9 → 1, opacity), instant under reduced motion.

**Risks.**
- 667 items don't fit 8×8; anything outside a group's top 8 needs typing or `More…`.
- The curated groups are an editorial call that can be wrong for someone's habits.
- Digit keys mean two things (choose vs quantity); the "after a pick, digits are quantity" rule must be visible.
- Wheel near the screen edge has to shift; a shifted wheel breaks "flick without looking".
- Occludes ~300 px around the spot (but not the spot itself).

---

## B. Field note: type-to-add at the spot

**Thesis.** The fastest input a desktop player has is the keyboard, and they already know the item names. A small command line pinned to the spot on the map, with a forgiving grammar and frecency ranking, turns "12 matches, 3 peaches, hatchet" into three Enters.

**Interaction model.**
- **Open:** `A` with the pointer over the map (spot = pointer), right-click, or `Enter` on a selected marker (adds to *that* spot). A crosshair pin drops at the spot and a slim ink input attaches to it like a map label, not a dialog.
- **Empty input** shows suggestions: `Again: <last item>`, then this run's frecency top 6 as chips.
- **Grammar:** `12 matches`, `matches 12`, `matches x12`, `12x mat` all mean 12 × Wood Matches. Each `Enter` commits the top suggestion as a chip *on the map next to the spot* (the chip shows icon + quantity; that's the confirmation). `,` also commits. `↑/↓` choose another suggestion, `Tab` completes the name.
- **`Enter` on an empty line closes.** `Backspace` on an empty line pulls back the last chip for editing.
- **Note:** anything after ` - ` or `#` ("hacksaw - car trunk"), or `Tab` from an empty line.
- **Stays open across alt-tab**: focus returns to the line when the window regains focus, so S5 is "come back, keep typing".

**Flows.**

| | Clicks | Keys | How |
|---|---|---|---|
| S1 | 0 | ~50 | `A`, "12 mat⏎ 3 pea⏎ 2 rif⏎ hat⏎ sew⏎ too⏎ 2 clo⏎ 5 fir⏎ ant⏎", `⏎` |
| S2 | 0 | ~25 | `A`, "20 rif⏎ hun⏎ 6 pea⏎ 10 fir⏎ ⏎" |
| S3 | 1 | ~20 | right-click, "hacks - car trunk⏎⏎" |
| S4 | 5 | 10 | 5 × (right-click, `⏎` on "Again", `⏎`) |
| S5 | 0 | ~12 | line still open after alt-tab; type 2 more, `⏎` |


**Keyboard model.** `A` open at pointer, letters type, digits quantity in-line, `⏎` commit / close, `↑↓` pick suggestion, `Tab` complete / note, `Backspace` on empty re-edits last chip, `Esc` closes (keeps what was committed), `Ctrl+Z` undo batch.

**Look.** A 36 px ink plate with a hairline border and an apricot caret, anchored 20 px right of the spot with a short leader line; chips are the existing marker tiles in miniature with apricot quantity pills. Suggestions list is a popover-ink panel, bone text, muted category in label type.

**Risks.**
- Weak for mouse-only use (typing is the whole idea).
- Parse ambiguity ("2 rif" = rifle or rifle ammo?): needs ranking that prefers what you logged before, and visible confirmation chips.
- Discoverability of the grammar; first-time users will just type names (which still works).
- Typing on the second monitor means moving the hand from WASD; fine between actions, not during.

---

## C. Rummage: a loot session on a building

**Thesis.** In the game you search a container and get a list of what's inside. Mirror that: open a spot (usually a building) as a **session**, and tick what you found from a list that already contains the likely items. The session docks beside the map, survives alt-tab, and everything lands on the same spot.

**Interaction model.**
- **Open:** click a POI plate and choose "Log loot here", or right-click / long-press any spot (snaps to a pinned POI within ~40 map px; otherwise an "Unnamed spot"). `A` opens at the pointer.
- **Session panel** (docked right on desktop, 360 px; bottom sheet on phone) titled with the place ("Pleasant Valley Farmstead · searching"):
  1. **Already here**: what this run has logged at this spot, each with a looted toggle. Stops duplicate logging.
  2. **Likely here**: 12–16 tiles chosen from the POI type (residential → food, matches, clothing; industrial → tools, scrap, lantern fuel; cave → firewood, corpse loot…) blended with this run's frecency. A hint, never a claim (loot is random, RESEARCH §1).
  3. **Search** for the rest (folded, prefix-first).
- **Tick to add**: click a tile → it's added (qty 1, apricot ring on the tile, quantity pill). Click again → +1. Digits while a tile is focused/last-ticked set the quantity. Right-click or `−` decrements.
- **Live**: every tick writes immediately (one batch per session for undo). The map shows the spot's tile growing.
- **Close:** `Done`, `Esc`, or click another spot (moves the session).

**Flows.**

| | Clicks | Keys | How |
|---|---|---|---|
| S1 | 1 + 9 | 6 | click the plate/spot, tick 9 tiles (most are in "Likely"), 6 quantity digits; maybe 1–2 searches (~8 keys) |
| S2 | 1 + 4 | 7 | same at the base spot |
| S3 | 2 | ~12 + search | right-click, search "hack⏎", note field, done |
| S4 | 10 | 0 | 5 × (click spot, tick firewood: "Likely" includes it, frecency) |
| S5 | 0 | 0–4 | the session is still open; tick 2 more |


**Keyboard model.** `A` open at pointer, `Tab`/arrows move across tiles, `Space`/`Enter` tick, digits quantity, `-` (by `code` Minus) decrement, search focus with `/` or just start typing, `Esc` done.

**Look.** Rail-ink docked panel like the side panel; the header uses the POI plate styling (glacier pin dot + uppercase plate type) so it reads as "this place"; tiles are marker-ink squircles that gain the apricot ring and qty pill when ticked, i.e. they look like the markers they're creating. "Already here" uses the wash-out for looted items.

**Risks.**
- The likely-items table is editorial and per POI type; POI types in the data are inconsistent (80 untyped, mixed case).
- More chrome than the other concepts; on a phone the sheet competes with the map.
- Best when POIs are pinned; on unpinned spots it degrades to "search + frecency", which is concept B with tiles.
- Tick-to-add means a misclick is an add (undo and the decrement must be obvious).

---

## D. Satchel: a tray of items you stamp onto the map

**Thesis.** Pick the item once, then place it as many times as you like. A docked "satchel" tray of item tiles works like the game's hotbar: number keys arm a tile, the pointer becomes a stamp, every click drops one. Drag-and-drop is the one-off twin.

**Interaction model.**
- **Tray** docked along the bottom of the map (desktop) as a single row of 10 slots: pinned favourites first (drag to reorder, pin from any marker), then this run's frecency. A `+` slot opens search to arm any item.
- **Arm:** click a tile, or press `1`–`9`/`0`. The pointer shows the item icon with an apricot ring; a small banner reads "Placing Wood Matches ×1 · click the map · Esc to stop".
- **Quantity while armed:** digits set it (`1` `2` → ×12 before the next stamp), mouse wheel with `Shift` nudges it.
- **Stamp:** every map click drops a marker. Clicking an existing unlooted marker of the same item stacks (+qty). Clicking an existing *spot* of other items adds to that spot.
- **Batch at one spot (S1):** `Shift`-click a spot to **hold** it: the spot stays selected and every armed item goes there with `Enter` (arm `3`, `Enter`, arm `5`, type `12`, `Enter`…).
- **Drag** a tile onto the map = one add at the drop point; arming not needed.
- **Disarm:** `Esc`, right-click, or click the armed tile again.

**Flows.**

| | Clicks | Keys | How |
|---|---|---|---|
| S1 | 1 | ~25 | Shift-click to hold the spot, then 9 × (slot digit, `Enter`) + 6 quantity digits; items outside the tray: `+`, type ~4, `Enter` |
| S2 | 1 | ~15 | same |
| S3 | 1–2 | ~15 | `+`, "hack⏎" arms, click the spot, `E` on the new marker for the note |
| S4 | 5 | 2 | `1` (firewood slot), 5 clicks along the route, `Esc` |
| S5 | 1 | ~6 | Shift-click the existing spot, arm and `Enter` ×2 |


**Keyboard model.** `1`–`9`,`0` arm slots, `+` slot via `S`, digits after arming set quantity, `Enter` places at the held spot, `Esc` disarm/release. Note: today `1`/`2`/`3` switch panel tabs; this variant moves those to `Alt`-free alternatives (the panel tabs keep their click targets and `P`), a conflict to resolve.

**Look.** A rail-ink strip with hairline top border, the same marker-ink squircles as map markers, slot numbers as small bone numerals, the armed tile lifted with the apricot ring; the cursor stamp is a 34 px ghost marker at 70 % opacity.

**Risks.**
- **Mode errors**: forgetting a stamp is armed and dropping loot with an ordinary click. Needs a loud armed state and auto-disarm on map change.
- Weak at S1-style "nine different things at one spot" unless the hold-spot + Enter path is learned.
- Tray takes a strip of map height; must collapse on small screens.
- Digit keys clash with the existing panel-tab shortcuts.

---

## Comparison at a glance

| | A Wheel | B Field note | C Rummage | D Satchel |
|---|---|---|---|---|
| Best at | mouse-first S1, game muscle memory | keyboard S1/S2/S5 | coming back to a building, de-duplication | S4 repeats, route logging |
| Weakest at | items outside the curated groups | mouse-only use | speed for a known item list, chrome | many different items at one spot |
| Primary input | pointer flick / digits | typing | ticking tiles | arm + click |
| Occludes the map | ring around the spot | a label-sized line | a docked panel | a bottom strip |

## Shared seam (on `feat-add-item-lab`)

- `?addui=legacy|a|b|c|d` (persisted per device) plus a small "Add UI" switcher in the top bar's overflow menu in dev and lab builds.
- `app/composables/useAddItem.ts`: `addBatch(spot, entries, note)` with stacking into an existing spot, `undoLastBatch()`, `lastItemId`, `rankItems(query, { group })` (diacritic folding, prefix-first, frecency), `frecentItems(n)`, `LOOT_GROUPS` (curated 7 groups for A/D), `likelyItemsForPOI(poi)` (for C), `nearestSpot(pos)` (POI pin or existing marker cluster within a radius).
- `InteractiveMap.vue`: map-click/contextmenu/long-press events carry the map position and the screen point, a pointer-position ref for "spot = pointer", and an interceptor hook so a variant can own clicks (stamp mode).
- Each variant is one component, `app/components/add/AddUi<A|B|C|D>.vue`, mounted by the shell when selected; no variant edits shared files beyond the seam.
