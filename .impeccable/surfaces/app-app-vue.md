---
version: 1
slug: "app-app-vue"
primary_target: "app/app.vue"
related_targets: ["app/components"]
---

# Surface: TLD Buddy app shell (map workspace)

Mode: Operate. Build path: code-led (Operate surface). Direction pinned by the user: follow The Long Dark's own art direction (painterly / "water-colour" storybook look, two-tone white-on-dark HUD, sparse muted accents). No concept-seed roll: a user-pinned direction beats the roll.

Audience/job: one player mid-session on a second desktop monitor (tablet/phone secondary). Record items spotted, tick them off as looted, check stashes, switch maps, and do it fast.

## Direction contract

THESIS: The map is the whole screen. The interface sits on it like the game's own HUD: bone-white uppercase labels on dusk-ink panels, colour used sparingly and only for state. It rejects the category default of a grey admin sidebar with a toolbar full of equal icon buttons.

OWN-WORLD: Dusk-ink ground (deep blue-slate, painted-night hue 255), bone-white text, a single sunset-apricot accent for "loot still here", a pale aurora-mint check for "looted", rust-red for danger, ochre for warning. Labels are uppercase and tracked like the game's HUD; body text is a plain system sans. Corners are soft, borders are hairlines, there are no glows.

STORY: The player sees which loot on this map is still there and what's already taken, opens a spot in one click, ticks it off with one key, and searches anything (item, place, map) from anywhere.

FIRST VIEWPORT: Full-bleed Leaflet map. Thin dusk-ink top bar: wordmark, map switcher (map name), run chip with difficulty colour, search field (/ or Ctrl-K), sync status, travel toggle, menu. A collapsible left panel (Loot / Places / Maps tabs, 360px) over the map edge. Bottom-centre: "Add loot" primary (A). Bottom-right: zoom/fit. A selected marker opens a compact action card over the map with Looted (L), Edit (E), Delete.

FORM: Pinned art direction (TLD painterly HUD), position 1 on the list; the roll ran and its dealt hand was set aside because a user-pinned direction beats the roll. seed:98f7f66290e8ff78

Signature move: the looted state is drawn as a watercolour "wash-out". A taken item's tile fades and desaturates into the map with a pale mint tick, while remaining loot keeps a crisp apricot ring. The map reads as a painting where what's left stands out.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
