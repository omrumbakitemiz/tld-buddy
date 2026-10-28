# B · Field note — fix round 1

Branch `feat/add-item-b`. Merged `origin/feat/add-item-lab` at `8c2fb43`, retaining lab's concentric `ringSlot` implementation instead of B's golden-angle version. Select `?addui=b` or overflow → Add flow → B · Field note.

## Changes against the eight consolidated findings

1. **Speed:** empty input shows six compact icon/name quick picks with Alt+1–6 hints; each is one click or one chord. Space on an empty line repeats the last item and finishes the visit. S4 is now five right-clicks + five Space presses. Leading digits remain quantity text. The merged ranking was verified in Chrome: `pea` selects Pinnacle Peaches, `fir` selects Fir Firewood.
2. **Existing loot:** a separate Before this visit section shows original item icons, names, quantities, and looted state (muted/desaturated icon, mint quantity and visible Looted label). Remaining items retain apricot quantities and a screen-reader Still here label. This visit has its own chips, quantities and note indicators. These are baseline quantities, not a second tally of the growing live pile.
3. **Toasts:** commits update chips and the map with no announcement toast. Finishing a nonempty visit emits one shared summary with Undo. Undo/error feedback is separate. An automated assertion checked no Undo toast appeared during S1 before closing.
4. **Enter:** empty Enter always finishes without adding anything. Nonempty Enter adds the visibly selected match; while editing, it updates the entry. Space, not Enter, is repeat-and-finish. Empty picks display Alt-number hints and never imply Enter adds them. Footer hints describe the current state.
5. **Editing/Undo:** empty Backspace opens the last entry in place. Its existing marker remains until the edit commits. Quantity correction calls `amend()` with the total contribution this visit made to that marker, including earlier repeated lines. It preserves marker IDs and earlier entries. Changing item/note removes only that line's contribution and adds its replacement. Remove entry calls `amend(..., 0)` when it was the sole contribution. Cancel edit leaves the saved entry intact. Ctrl+Z on a fresh visit calls ordinary latest-batch Undo; zero changes reports Nothing to undo, never Undone.
6. **Input retention:** Escape, Done, background click, right-click elsewhere and tile click retain unfinished text, refocus the line and explain how to finish/discard. Discard draft is explicit; Cancel edit keeps the original saved entry. Printable keys after a map drag are routed back to the line, including the first character. Window focus return restores input focus. Unfinished map/run drafts are retained in memory with their original spot and edit batch for restoration when that context is opened again.
7. **Bugs:** empty Tab without a committed entry asks for an item first; it never invents a ` # ` query. Hash parsing handles note-only input as an empty query and commit refuses it. While open, a loot tile/place-plate click moves the note to that spot and swallows normal selection; with a draft it keeps the original spot instead. Right-click uses the new tile-aware request. Combobox `aria-expanded`, `aria-controls`, and `aria-activedescendant` follow actual suggestion visibility. Mouse presses on note controls preserve input focus so blur cannot shift the footer out from under a click.
8. **Craft/code:** added the specified floating-card shadow (`0 8px 28px oklch(0.1 0.02 258 / 0.6)`) and a short leader from crosshair to the nearest plate edge. Empty suggestions occupy two columns instead of six full rows. Functions, transaction state and handlers are expanded into readable blocks. Tokens, system fonts, HUD labels, motion and reduced-motion rules remain inherited.

**Objections:** none to the requested fixes. Alt+number is a deliberate choice within item 1's suggested approaches: bare digits would conflict with leading quantities such as `12 mat`. On macOS Option-number is handled by physical `Digit1`–`Digit6`, independent of the resulting character.

## Full keyboard model

- `A` with pointer over map opens there. Outside map, A/button/palette/panel asks for a map click. Right-click, Shift-click and existing long-press still open at their spot. Enter on an already selected marker/pile opens there.
- Type item names, optional quantity and note. Supported forms: `12 matches`, `matches 12`, `matches x12`, `12x mat`, `hack #car trunk`, `hacksaw - car trunk`. Quantity clamps to 1–999. Hash needs no spaces.
- Nonempty `Enter` or comma commits the highlighted result and keeps the line ready. Commas within a note remain punctuation. Held Enter does not repeatedly commit.
- Empty `Enter` finishes, always. It never selects Again or a frequent item.
- Empty `Space` repeats the last item at quantity 1, then finishes. Without a last item it explains that an item must be added first.
- Empty `Alt+1`–`Alt+6` picks the corresponding quick suggestion and stays open. Clicks on quick picks do the same. These slots follow this run's frecency, with Again first when available; they are labelled shortcuts, not permanent item positions.
- `Up`/`Down` choose a search match. `Tab` completes its name, preserving quantity/note. `Tab` after a commit on an empty line opens that entry with a note delimiter. Empty Tab with no entry explains the grammar. `Shift+Tab` follows normal focus navigation.
- Empty `Backspace` edits the last entry. Enter updates; Cancel edit or clearing the line keeps the original. Remove entry removes that entry's contribution, preserving all other quantities.
- `Esc` or Done finishes if the line is empty. With a draft it stays open with guidance. Click Discard draft explicitly before leaving without saving it. Unfinished typing is not automatically committed to a guessed match.
- `Ctrl+Z` / `Cmd+Z` undoes this visit, or the latest saved batch on a fresh visit. The shared toast also undoes a closed visit. A draft is retained through Undo and can be edited or discarded.
- The shell's single-key shortcuts (`A L H N / ? P [ 1 2 3 F + - T R E Del Esc`) pause through `active`. They type normally in the line; Escape deliberately requests dismissal. No idle shell shortcuts are replaced. Alt+1–6 is local to an empty open line.
- Clicking ordinary background finishes an empty visit. Clicking a tile/plate while open moves the note; with text it preserves the old spot. Map drags keep the visit; later letters return to the line.

## Measured counts

Actual Chrome run through `/tmp/tld-lab-tools/lab.mjs`, 1600×1000, localhost:3102, lab Redis DB 2 reseeded first. Each typed character (including spaces/delimiters) and each named key press is one key action; a modifier chord counts as one. Opening and finishing count. Setup zoom, pointer motion, verification and OS-switch keys do not count. No learned history was artificially injected.

| Scenario | Clicks | Keys | Measured sequence (`↵` = Enter) |
|---|---:|---:|---|
| S1 · nine-item farmhouse | 0 | 49 | `A`, `12 mat↵3 pea↵2 rif↵hat↵sew↵toq↵2 clo↵5 fir↵ant↵↵` |
| S2 · base stash | 1 | 29 | right-click, `20 rif↵hun rif↵6 can↵10 fir↵↵` (Recycled Can verified) |
| S3 · rare item + note | 1 | 17 | right-click, `hack #car trunk↵↵` |
| S4 · five firewood spots | 5 | 5 | after priming Fir Firewood outside measurement: five × right-click, Space |
| S5 · drawers, return later | 1 | 27 | right-click, `3 mat↵2 clo↵sew↵`, blur/return focus, `4 clo↵hat↵↵` |

S5 uses actual input blur + window focus events, not OS-level alt-tab or a running game. No time delay is required by the implementation; the session stays open until finished. The measurements are interaction counts, not elapsed-time benchmarks.

## Verification and evidence

- S1 API readback: nine markers, quantities `[12,3,2,1,1,1,2,5,1]`, concentric ring positions; grouped marker count 9 and sidebar quantities verified.
- S3 API readback: Hacksaw, note `car trunk`.
- S4 API readback: current-map/run Fir Firewood quantity increased by exactly five, one per Space repeat.
- S5 API readback: cloth stacked 2 + 4 to 6. Closing-toast Undo removed all four unique markers from that visit.
- Mistake + edit + Undo: reopen S1 pile via right-click; add matches 2, hatchet 1, matches 4; edit last to 3. Existing matches changed from 12 to 17; every pre-visit marker ID survived. Ctrl+Z restored the entire pre-visit marker array exactly. A separate POI-plate test corrected a newly created marker from 2 to 3, retained its ID, and undid to the exact baseline.
- Remove entry restored the pre-visit marker array; Ctrl+Z with no remaining batch reported Nothing to undo. A note-only `#drawer` refused to create a marker.
- Fresh-visit Ctrl+Z reduced the last saved firewood batch by exactly one. Empty Enter closed without adding. Tab and Space with no last item produced guidance and no unintended marker.
- Draft survived Escape, background click and loot-tile click. Alt+1 added exactly one chip. An actual mouse drag followed by typing retained the full word `hacksaw`, including the first letter. Tile interception moved the note with no normal loot-card selection. No browser page errors.
- `npx nuxi typecheck`: pass. `pnpm build`: pass (existing Browserslist, sourcemap and VueUse annotation warnings). `pnpm test`: pass, 15 app-data + 17 add-item tests. Mechanical design detector: no findings.
- New pure-logic checks cover note-only parsing and the per-marker contribution sum used by amendment. Lab's existing ranking and concentric-ring regression checks remain intact.

## Screenshots

All 1600×1000 PNG, refreshed for this round and visually inspected:

- `01-idle.png`: working desktop map.
- `02-open.png`: compact empty quick picks, leader and shadow.
- `03-mid-batch.png`: five committed items, no per-item toast.
- `04-after.png`: nine-item group, one closing Undo toast.
- `05-existing.png`: seeded existing loot with quantities and looted state, separately from a new addition in This visit.

## Seam, boundaries and remaining gaps

No new seam edits. The merge accepted lab's `ringSlot`, `amend`, tile-click interception, zoom-aware snapping, `scale()` and ranking changes. No other variant implementation was edited. Marker data shape is unchanged. Legacy UI is untouched by B's changes.

Unfinished drafts are component memory, not durable storage; reload/variant replacement does not preserve them. Actual OS/game focus switching still needs a two-monitor player check. The shared renderer groups nearby ring members at normal zoom; the tile shows item count while chips/sidebar/accessible labels show quantities. Existing-loot chips preserve the pre-visit snapshot rather than continuously reflecting remote edits. The storage composable owns sync/offline status; chip confirmation means a local marker edit, not a completed server write.

Next: repeat the critic walkthrough with these keyboard rules, then validate real alt-tab and mouse/keyboard switching with the player. No new web font or touch-specific UI was added. Existing DESIGN.md remains authoritative; no design-system changes were made. Design QA was performed inline without further delegation.
