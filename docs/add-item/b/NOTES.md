# B · Field note

Implemented on `feat/add-item-b`, stacked on lab commit `fc8fc6d8c5e4bc7ca0ac1617125508f0bf51de3e`. Select `?addui=b` or overflow → Add flow → B · Field note.

## How it works

A 360px ink note sits 24px beside the selected map spot, flips left near the right edge, and clamps inside the map viewport. A crosshair keeps the spot visible. Its height follows its actual content. It uses existing rail, border, bone, apricot, muted, HUD and tabular tokens; no fonts, glow, new theme, or touch-specific UI.

The line searches all items through the shared prefix/fuzzy/frecency search. Six visible suggestions show the selected item and parsed quantity before Enter. Empty suggestions start with the last item, then frequent items in this run. Each committed entry appears as an icon/name/quantity chip; noted entries carry a note icon and tooltip. Chips scroll after three rows. The map updates immediately. Closing keeps committed items and discards only unfinished text.

The note stays open while focus leaves the window and refocuses the line when the window returns. It closes on map/run changes so a stale spot cannot write into another map. Clicking ordinary map background finishes the visit. Existing marker and POI selection still works. While open, the floating Add loot button is hidden.

## Full keyboard model

- `A` while the pointer is on the map: open at the pointer. Outside the map, the normal placement hint asks for a map click. The floating button, palette, panel, Shift-click, right-click and existing long-press use the same handlers.
- `Enter` on a selected marker or pile, outside other controls/dialogs: open at that pile. The capture handler prevents the shell from handling that event.
- Letters/digits: ordinary editable text. `12 matches`, `matches 12`, `matches x12`, `12x mat` parse through the shared grammar. Quantities clamp to 1–999.
- `Enter` or comma: commit the selected match. Comma inside a note stays literal punctuation. Repeated held Enter does not commit repeatedly.
- Empty `Enter` after a commit: finish. Empty `Enter` at a newly opened spot: repeat the suggested last item; the next empty Enter finishes. On a device without a last item, the first run suggestion is selectable instead.
- `Up`/`Down`: wrap through suggestions. Clicking a suggestion commits it too.
- `Tab` with text: complete selected item, preserving quantity/note. `Tab` on an empty line after a commit: reopen that entry with a note delimiter. On a new empty visit it starts a note for the repeat item. `Shift+Tab` follows normal focus navigation.
- `#` (spaces optional) or ` - ` introduces an item note. Note text is visible before commit; for example `hacksaw # in the car trunk`.
- Empty `Backspace`: pull back the last committed entry, including its quantity/note, for editing.
- `Esc` or Done: finish, keeping committed entries. Unfinished text is discarded.
- `Ctrl+Z` / `Cmd+Z` while open: undo this visit, clear its chips, retain the spot. Shared toast Undo does the same data undo. After closing, the shell's ordinary batch Undo applies.
- All shell single-key shortcuts (`A L H N / ? P [ 1 2 3 F + - T R E Del Esc`) pause via `active` while the note owns the keyboard. They are text when typed in the line; Escape deliberately finishes. No global numeric shortcuts are replaced. Modifier shortcuts other than Undo remain with the shell/browser.

Each visit is one shared batch. Re-editing the last entry uses the existing seam: undo the visit, replay earlier entries as a fresh batch, and return the removed entry to the line. This avoids direct marker writes, but creates new IDs for that visit's newly added markers. Previously existing stacked markers keep their IDs.

## Measured desktop scenarios

Chrome through `/tmp/tld-lab-tools/lab.mjs`, 1600×1000, localhost:3102, Redis DB 2, fresh lab seed. Counted each typed character and each named key press as one key; spaces and delimiters count. Pointer motion/zoom setup and verification do not count. A chord counts as one key action. Counts include opening and finishing. These are actual conservative queries, not the concept document's estimates or a lower-bound claim.

| Scenario | Clicks | Keys | Typed sequence (`↵` = Enter) |
|---|---:|---:|---|
| S1 · nine-item farmhouse | 0 | 71 | `A`, `12 wood mat↵3 peaches↵2 rif↵hat↵sew↵wool to↵2 cloth↵5 fir fire↵antis↵↵` |
| S2 · base stash | 1 | 47 | right-click, `20 rif↵hunting rif↵6 recycled can↵10 fir fire↵↵` |
| S3 · rare item + note | 1 | 28 | right-click, `hacksaw # in the car trunk↵↵` |
| S4 · firewood at five spots | 5 | 10 | after priming Fir Firewood outside the measurement, five × right-click, `↵↵` |
| S5 · drawers, return later | 1 | 36 | right-click, `3 wood mat↵2 cloth↵sew↵`, leave/return focus, `4 cloth↵hat↵↵` |

S5 focus loss/return was driven with window blur/focus events and real input blur; this checks the application lifecycle but does not claim an OS-level alt-tab or a running game. App-switch key presses are excluded. The spot remained open and cloth stacked from 2 to 6. A separate selected-pile Enter test reopened an existing spot after closing.

## Verification

- S1: API readback verified nine actual markers, quantities `[12,3,2,1,1,1,2,5,1]`, one local ring; map group showed 9 and the sidebar showed quantities.
- S3: API readback verified Hacksaw with exact note `in the car trunk`.
- S4: each new spot showed `Again: Fir Firewood`, then received its repeat.
- S5: API readback verified cloth stacked to 6. Shared toast Undo removed the four unique markers from that visit (including both cloth contributions).
- Empty Backspace returned `12 Wood Matches` for correction. Ctrl+Z cleared the session's committed chips. Empty Tab reopened Hatchet for a note, then keyboard Undo worked.
- Legacy query still opened its existing Add loot here dialog with a map right-click.
- `npx nuxi typecheck`: pass. `pnpm build`: pass (existing Browserslist, sourcemap and VueUse annotation warnings). `pnpm test`: pass, 15 app-data + 14 add-item tests.
- Impeccable mechanical detector: no findings. Desktop captures visually inspected. Inline finish review used because the implementation-agent brief prohibits further delegation. No phone review was performed (explicitly out of scope).

## Seam change

`app/lib/addItem.ts`: the shared batch planner now uses a fixed golden-angle step for each new ring member. Previously the denominator grew on each incremental commit, so the seventh through ninth members converged almost onto the sixth. The fixed step keeps those entries apart without moving saved markers, changing stacking rules, marker radius, Redis shape, or legacy UI. A regression test simulates nine incremental entries and checks pairwise separation above five map pixels. No composable, shell, host or other variant files changed.

## Captures

All PNG, 1600×1000: `01-idle.png`, `02-open.png`, `03-mid-batch.png` (five committed items), `04-after.png` (nine-item group). Taken on the seeded Mystery Lake map; zoom increased for a useful desktop working view.

## Known gaps and next work

- Search ambiguity remains deliberate: `pea` selects Peach Pie (whole-name prefix), while `peaches` selects Pinnacle Peaches. The selected name is visible. Test shorter learned queries with a player before changing shared search ranking.
- Empty Enter repeats the last item on a fresh visit but closes after a commit; the footer describes the current action. A second-monitor usability session should validate this distinction.
- Focus return is tested through browser events, not real OS/game switching. Test that on the player's two-monitor setup next.
- The existing shared marker renderer groups close ring members at normal zoom. Quantities live in the chips, sidebar, and accessible marker label; the grouped tile itself displays distinct-item count.
- The shared storage composable owns offline/sync feedback. The note confirms local marker creation, not a completed network save.
- Re-edit replays the current visit (see above). A future generic amend-last-entry seam could avoid regenerating its new IDs.
- Fixed-step rings avoid the observed nine-item convergence; very large piles still crowd at the fixed 12px radius.

Design documentation check: existing `DESIGN.md` and tokens remain authoritative and unchanged. Rail palette, system type, HUD labels, hairline plates, apricot quantity/focus and reduced-motion handling match the incumbent system. Pre-existing `.impeccable/design.json` drift was not repaired; `impeccable document` can refresh it separately.
