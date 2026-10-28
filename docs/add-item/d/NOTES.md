# Satchel — round 1

Satchel is a device-local favourites tray followed by this run's frecent items. Right-click an empty map spot or tile to hold it, then type entries such as `12 wood mat` or `hack - car trunk` and press Enter to add the highlighted result immediately. The held marker remains visible and the tray lists additions. Search ranks through the shared seam; Up/Down choose another match. Right-click while armed stamps at that location; ordinary map and tile clicks also stamp while armed. Each route stamp and drag is its own undo batch; additions in one held session share a batch. Dragging a slot uses the drop point even while a spot is held.

Slots are pinned first, then frecent. Arm a slot to pin/unpin it or move a favourite with the chevrons; a selected individual map marker can also be pinned. These preferences remain localStorage UI state. The tray displays the armed item, quantity and note; a translucent 34 px marker follows the map pointer. Armed state survives blur/focus, and clears explicitly on Esc, Stop, clicking the armed slot, or a map/run change. A held-spot Enter clears the arm after placement so the next item can be entered. There is no inactivity timer.

## Keyboard

- At idle the shell owns 1/2/3 and S; Q focuses the tray. Dialogs and editable fields retain their keys. When the tray is focused, a spot is held, or an item is armed, Satchel owns its applicable keys and the shell pauses single-key shortcuts.
- With tray focus and nothing armed, 1–9/0 select a slot; with an item armed, digits set its next quantity (1 then 2 means 12). Enter places an armed item at a held spot. Click the same slot to disarm it.
- At a held spot, the entry field takes text, quantity, and optional ` - note` or ` # note`; Enter adds the selected result directly. Up/Down select a result. Enter in the separate note field places an armed item at the held spot. When unheld, Q then S opens search to arm an item.
- Esc stops the session. Ctrl+Z / Cmd+Z and the shared toast undo a batch. Other shell shortcuts work when the Satchel is idle; editable fields and dialogs are not intercepted.

## Measured browser runs

Driven with `lab.mjs` at 1600 × 1000 on freshly seeded DB 4. Counts include typed characters, Enter and Escape; clicks are mouse presses. Search strings are recorded below, so these are measured rather than estimates. S4 used Q, S and search rather than a pinned slot; a known slot needs fewer keys.

| Scenario | Clicks | Keys | Path |
| --- | ---: | ---: | --- |
| S1 | 1 | 66 | Right-click, nine entries including quantities, Escape. |
| S3 | 1 | 25 | Right-click, `hack - in the car trunk`, Enter, Escape. |
| S4 | 5 | 9 | Q, S, `fir f`, Enter, five stamps, Escape. |
| S5 | 2 | 36 | Right-click, three entries, close; right-click the same pile, two entries, close. |

API data assertions checked the S1 item names, quantities and nine distinct ring slots; S3's exact note; five distinct S4 locations; S5 stacking from 3 to 5; and undo restoring 3 and removing the other S5 entry. A blur/focus test retained an armed ×5 and right-click placed that quantity. Separate browser checks covered idle 1/2/3, dialog key isolation, drag while holding a spot, and Enter in the note input.

## Seam and objections

Merged the updated lab seam: its unbounded concentric ring planner, screen-aware snapping and tile interception replace the previous D-specific changes. D uses `interceptTileClick` for Shift-click holding and armed stamping on tiles. No Redis shape changes.

The critique asks both for right-click on an empty map to disarm and for an armed right-click to place there. Those actions conflict at the same location. This implementation follows the explicit right-click placement requirement; Esc, Stop and clicking the armed slot disarm instead. The visible status and cursor ghost stay on through alt-tab.

At low zoom Leaflet groups nearby markers, so ring members display as one pile until zoomed in. Search is text-based without category filters. An open held session groups its additions into one undo step; the next improvement would be an individual-item correction control in the held list.
