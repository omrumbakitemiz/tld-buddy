# Satchel

The bottom tray holds up to ten per-device pinned favourites followed by this run's frecent items. Click a tile to arm it; Pin/Unpin and the left/right controls manage favourite order. Drag a tile onto the map for a one-off placement. Shift-click the map, a marker, or a place to hold a spot: select an item and press Enter to add it; the spot stays held and the next selection is ready. Search uses the shared prefix/frecency ranking. Adds at a held spot share one undo batch; stamps and drops are individual batches. Notes attach to the next placement. The ring at the held spot remains visible on the map.

## Keyboard

- With no item armed, 1–9 and 0 arm tray slots. These keys take precedence over the shell's 1/2/3 panel tabs whenever Satchel is selected; the tabs remain clickable, and P still toggles the panel. They are not intercepted in text fields or with modifiers.
- Once armed, digits set the quantity for the next stamp or Enter (e.g. 1 then 2 means 12); the quantity resets to 1 after placement. To choose another slot, stop the current arm first; held-spot Enter automatically disarms after each item.
- At a held spot, type a letter to search; Up/Down select a result and Enter arms it, then digits and Enter place it. S opens search when no spot is held. Search fields accept ordinary typing and Enter selects the highlighted result.
- Esc or right-click stops the session. Window blur and 30 seconds without an armed action disarm the stamp; the held spot survives blur. Changing map or run stops the entire session. The armed banner names the item and quantity. Ctrl+Z and the toast undo use the shared undo stack.
- Other shell shortcuts (A, L, H, N, /, ?, P, [, F, +, -, T, R, E, Delete) remain shell-owned when the Satchel is not active. When a session owns the keyboard, shell single-key shortcuts are paused; text inputs keep their normal editing keys. Tab navigates controls.

## Measured scenarios

Driven with Playwright through `lab.mjs` at 1600 × 1000, against freshly seeded DB 4. Counts include Shift as one key per held-spot click, Enter and Escape, and all typed search/note characters; mouse clicks include focusing and leaving the note field. These are actual search-based runs, not estimates for a pre-pinned tray.

| Scenario | Clicks | Keys | Tested path |
| --- | ---: | ---: | --- |
| S1 | 1 | 71 | Hold; search nine items, enter quantities and place; close. |
| S2 | 1 | 45 | Hold; search four items, enter quantities and place; close. |
| S3 | 3 | 24 | Hold; search hacksaw, type “in the car trunk” in the note, place and close. |
| S4 | 5 | 8 | S, search “fir f”, Enter, stamp five positions, Esc. |
| S5 | 2 | 41 | Hold and add three; close, hold the same pile and add two; close. |

The API data was checked for nine distinct S1 ring positions and quantities, S2 quantities, S3 note, five S4 locations, S5 stacking (3→5), and undo restoring 3 and removing the other S5 addition. The full scenario uses a cold seeded catalogue; pinned slots can reduce typing.

## Shared changes and gaps

`InteractiveMap.vue` forwards registered variants' Shift-click and intercepted plain clicks on marker and POI tiles through the existing seam; legacy selection remains unchanged. `planBatch` uses stable concentric slots for incremental additions rather than recalculating angles, preventing overlapping placements in a nine-item batch; its test covers nine additions. No stored data shape changed.

The tray exposes ten slots; select an individual marker to pin its item, and arm a favourite to reorder or unpin it. Very large piles beyond the first 19 slots can reuse ring positions. Search does not offer category filters. The map's existing clustering still combines nearby tiles at low zoom. A next iteration should expand the ring layout for very large piles and add direct pinning from a marker.
