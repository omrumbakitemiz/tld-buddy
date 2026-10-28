---
name: TLD Buddy
description: A painted-dusk map companion for The Long Dark, worn like the game's own HUD.
colors:
  dusk-ink: "oklch(0.205 0.028 258)"
  rail-ink: "oklch(0.175 0.026 258)"
  map-ground: "oklch(0.17 0.025 258)"
  card-ink: "oklch(0.245 0.03 258)"
  popover-ink: "oklch(0.235 0.03 258)"
  marker-ink: "oklch(0.22 0.03 258)"
  muted-ink: "oklch(0.27 0.03 258)"
  accent-ink: "oklch(0.3 0.035 258)"
  hairline: "oklch(0.33 0.03 258)"
  input-stroke: "oklch(0.31 0.03 258)"
  bone: "oklch(0.945 0.014 85)"
  muted-bone: "oklch(0.76 0.03 255)"
  sunset-apricot: "oklch(0.82 0.105 58)"
  apricot-ink: "oklch(0.2 0.03 258)"
  aurora-mint: "oklch(0.84 0.085 170)"
  glacier-blue: "oklch(0.83 0.07 230)"
  dusk-lavender: "oklch(0.3 0.04 285)"
  lavender-mist: "oklch(0.92 0.025 285)"
  rust-red: "oklch(0.64 0.17 27)"
  ochre: "oklch(0.84 0.13 85)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: "1rem"
    letterSpacing: "0.08em"
  plate:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    letterSpacing: "0.05em"
  numeral:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 750
    lineHeight: "17px"
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  marker: "9px"
  pill: "9999px"
spacing:
  hairline-gap: "4px"
  tight: "6px"
  control: "8px"
  inset: "12px"
  dialog: "24px"
  rail-height: "48px"
  panel-width: "352px"
components:
  button-primary:
    backgroundColor: "{colors.sunset-apricot}"
    textColor: "{colors.apricot-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-floating:
    backgroundColor: "{colors.sunset-apricot}"
    textColor: "{colors.apricot-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.dusk-lavender}"
    textColor: "{colors.lavender-mist}"
    rounded: "{rounded.md}"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.dusk-ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.accent-ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    size: "36px"
  input:
    textColor: "{colors.bone}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  panel-tab-active:
    backgroundColor: "{colors.accent-ink}"
    textColor: "{colors.bone}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
  loot-marker:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.marker}"
    size: "34px"
  loot-marker-qty:
    backgroundColor: "{colors.sunset-apricot}"
    textColor: "{colors.apricot-ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.marker}"
    height: "17px"
  looted-tick:
    backgroundColor: "{colors.aurora-mint}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.pill}"
    size: "16px"
  poi-plate:
    textColor: "{colors.bone}"
    typography: "{typography.plate}"
    rounded: "{rounded.md}"
    padding: "3px 9px 3px 7px"
  poi-count:
    backgroundColor: "{colors.dusk-lavender}"
    textColor: "{colors.lavender-mist}"
    typography: "{typography.numeral}"
    rounded: "{rounded.marker}"
    height: "17px"
  loot-card:
    backgroundColor: "{colors.rail-ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.xl}"
    padding: "12px"
    width: "min(28rem, 100vw - 1.5rem)"
  difficulty-chip:
    textColor: "{colors.bone}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  dialog:
    backgroundColor: "{colors.card-ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: TLD Buddy

Research and rationale: [docs/DESIGN.md](docs/DESIGN.md) (sources on The Long Dark's art direction and the game-to-token mapping). This file records what shipped; where the two differ, this file and `app/assets/css/tailwind.css` win.

## Overview

**Creative North Star: "Painted Dusk"**

The map is the whole screen, and the interface sits on it the way The Long Dark's HUD sits on its water-colour world: bone-white lettering on deep blue-slate dusk, colour held back until it means something. The ground is a single family of dusk inks (hue 258), stepped a few lightness points apart so the rail, the content, cards and controls separate by tone, not by lines or glare. Against that ground there are exactly four meaningful colours: sunset apricot for loot still out there (and the primary action), aurora mint for looted, glacier blue for places, and the HUD's own red and ochre for danger and warning.

The surface is dense and quiet. It is an Operate tool used beside a running game in a dim room, so it is always dark, uses the system sans for everything you read, and borrows the game's voice only in its uppercase tracked labels. The painterly material comes from the community maps themselves; the chrome never imitates it with texture (a paper grain was tried and removed).

The signature move is the wash-out: a looted item's tile loses its fill and ring, its icon fades and desaturates into the painted map behind a soft ink edge, and a small keylined mint tick stays crisp, while remaining loot keeps a crisp apricot ring. The map reads as a painting where what is left stands out.

**Key Characteristics:**
- Dark-only (`color-scheme: dark`), one dusk-ink hue family for every surface.
- Colour carries state only: apricot = still there, mint = looted, glacier = place, rust = danger, ochre = warning.
- Bone-white uppercase tracked labels as the game's HUD voice; plain system sans for reading.
- Soft corners, hairline borders, dusk-tinted drop shadows, no glows.
- Map overlays are dark ink plates so they stay legible on the cream community maps.

## Colors

A nocturnal blue-slate ground with bone text and four sparing, pastel state colours taken from the game's skies.

### Primary
- **Sunset Apricot** (`sunset-apricot`): the one accent. Rings on loot still out there, the quantity badge, "Still there" text, the primary button (Mark looted, Add loot), focus rings, caret and text selection (at 35% alpha). Text on it is **Apricot Ink** (`apricot-ink`).

### Secondary
- **Aurora Mint** (`aurora-mint`): looted. The tick on a washed-out marker and "Looted 3h ago" text. Never used for actions.
- **Glacier Blue** (`glacier-blue`): places. The POI plate's pin dot, its 55%-alpha border, and its full border on hover/selected.

### Tertiary
- **Dusk Lavender** (`dusk-lavender`) with **Lavender Mist** text (`lavender-mist`): secondary buttons (e.g. "Not looted"), stash counts on POI plates, the active travel-mode toggle.
- **Rust Red** (`rust-red`): delete and errors, usually as text on an outline button with a 15% rust hover wash.
- **Ochre** (`ochre`): warning text only (offline, "Choose a run").

### Neutral
- **Dusk Ink** (`dusk-ink`): the app ground and default dialog background.
- **Rail Ink** (`rail-ink`): top bar, side panel and the floating loot card; one step darker than content so chrome recedes.
- **Map Ground** (`map-ground`): the Leaflet canvas behind the map image.
- **Card Ink** (`card-ink`) / **Popover Ink** (`popover-ink`): dialogs, dropdown menus, the search palette.
- **Marker Ink** (`marker-ink`): the tile behind item icons on the map, and the glyph colour inside the mint tick.
- **Muted Ink** (`muted-ink`) / **Accent Ink** (`accent-ink`): resting fills (item tiles at 50%) and hover/active fills (ghost buttons, active tab, highlighted menu item).
- **Hairline** (`hairline`) / **Input Stroke** (`input-stroke`): every border and divider; input outlines.
- **Bone** (`bone`): all primary text, POI labels, the selected-marker ring (90% alpha).
- **Muted Bone** (`muted-bone`): secondary text, section labels, icons at rest, placeholder.

### Named Rules
**The State-Only Colour Rule.** Hue appears only to say something about loot, places or danger. Difficulty, navigation, and decoration stay bone-on-ink; difficulty is shown as 1-5 bone pips, not a colour.

**The One Hue Ground Rule.** Every surface is hue 258 at chroma 0.025-0.035; depth is a lightness step (0.175 rail, 0.205 ground, 0.245 card), never a new colour.

## Typography

**Body Font:** system sans (`ui-sans-serif, system-ui, -apple-system, ...`)
**Label Font:** the same system sans, uppercase and tracked (pending: see Named Rules)

**Character:** One plain, fast-loading sans for everything you read; the game's voice comes entirely from the uppercase tracked label treatment, not from a display face. There is no display tier: the map is the hero.

### Hierarchy
- **Headline** (600, 1.125rem, line-height 1): dialog titles only.
- **Title** (500, 0.875rem): item names in the loot card and lists, the current map name in the top bar.
- **Body** (400, 0.875rem / 1.25rem): notes, descriptions, menu items, search field; muted bone for secondary lines, 0.75rem for status lines.
- **Label** (650, 0.6875rem / 1rem, +0.08em, uppercase): panel tab names, form labels, list section headings, the difficulty chip, and the wordmark (at 0.75rem).
- **Plate** (650, 11px, +0.05em, uppercase): POI name plates on the map.
- **Numeral** (750, 10px / 17px, tabular figures): quantity and count badges; all counts use `tabular-nums`.

### Named Rules
**The HUD Voice Rule.** Uppercase tracking is reserved for short labels that name a control, field or group, as the game's HUD does. Sentences, item names and notes are never uppercased.

**The Pending Face Rule.** Labels and plates currently render in the system sans. A self-hosted condensed HUD face for the label and plate roles is an open item awaiting the user's decision; until then, do not add a web font.

## Layout

Full-bleed map workspace. A 48px rail-ink top bar spans the width; beneath it a 352px (22rem) side panel docks to the left on tablet and desktop (768px and up) and the map fills the rest. Below 768px the panel becomes a bottom sheet (max 62dvh, 16px top corners, drag handle) and starts closed so the phone opens on the map. Floating chrome sits bottom-centre 16px above the edge: the Add loot pill, or the selected-marker loot card in its place, never both. Dialogs centre with 32px side gutters; the search palette pins to 12vh from the top.

Spacing is tight and 4px-based: 4-6px gaps inside controls and tab rows, 8px control padding, 12px card insets, 24px dialog padding. Controls are 36px tall (32px small, 40px large); on coarse pointers markers grow to 40px to meet the touch target floor.

## Elevation & Depth

Depth is mostly tonal (the lightness steps of the one ink hue). Shadows exist only on things that float over the map, and they are soft, dark and dusk-tinted (hue 258 at lightness 0.1), never coloured and never glows. The map edge is blended into the app ground with an inset dusk vignette.

### Shadow Vocabulary
- **Marker lift** (`box-shadow: 0 2px 6px oklch(0.1 0.02 258 / 0.55)`): item tiles and POI plates (at 0.45) on the map.
- **Badge lift** (`box-shadow: 0 0 0 1.5px oklch(0.16 0.03 258), 0 1px 3px oklch(0.1 0.02 258 / 0.5)`): quantity badge, group count and looted tick, each with an ink keyline so they hold on the cream map.
- **Marker keyline** (`0 0 0 1.5px oklch(0.16 0.03 258)`): outside the apricot ring of every remaining marker. Grouped tiles add a second offset tile behind (`4px -4px`) to read as a stack.
- **Floating action** (`box-shadow: 0 6px 20px oklch(0.1 0.02 258 / 0.55)`): the Add loot pill.
- **Floating card** (`box-shadow: 0 8px 28px oklch(0.1 0.02 258 / 0.6)`): the selected-marker loot card.
- **Sheet** (`box-shadow: 0 -8px 30px oklch(0.1 0.02 258 / 0.5)`): the phone bottom sheet; removed when docked.
- **Selected ring** (`box-shadow: 0 0 0 3px oklch(0.945 0.014 85 / 0.9), 0 4px 14px oklch(0.1 0.02 258 / 0.7)`): a selected marker, with a 1.22 scale.
- **Vignette** (`box-shadow: inset 0 0 80px 10px oklch(0.15 0.03 258 / 0.55)`): map edges.

### Named Rules
**The Float-Only Shadow Rule.** Docked chrome (rail, docked panel, list rows) has no shadow; only elements floating above the map cast one.

## Shapes

Soft, small corners from one 8px base radius: 4px chips and kbd hints, 6px controls, tabs, POI plates and menu items, 8px dialogs, menus and item-card thumbnails, 12px for the floating loot card, 16px for the bottom sheet's top. Item markers are 9px-radius squircles at 34px; badges are 17px-tall pills; the looted tick and POI pin dot are circles. Borders are 1px hairlines everywhere except the marker ring, which is a 2px stroke: solid apricot with an ink keyline while loot remains; looted tiles drop the ring for a soft 8px ink edge.

## Components

### Buttons
Compact and quiet; only one button per view is apricot.
- **Shape:** gently rounded (6px), 36px tall; icon buttons are 36px squares (32px inside cards, 40px in the loot card action row).
- **Primary:** apricot fill, apricot-ink text, 500 weight; hover drops to 90% opacity. The floating Add loot is the same button as a 44px pill with a kbd hint.
- **Secondary:** lavender fill with lavender-mist text (the "Not looted" state of the toggle).
- **Outline:** hairline border on dusk ink, accent-ink fill on hover; destructive is an outline button with rust text and a 15% rust hover.
- **Ghost:** transparent, accent-ink on hover; used for every top-bar icon.
- **Focus:** 2px apricot outline at 2px offset (global), plus a 3px ring at 50% on shadcn controls.

### Chips
- **Difficulty chip:** label type at 10px, bone on 40% dusk ink, hairline border, 4px radius, five 4px bone pips (filled 100%, empty 20%).
- **Count badges:** tabular numerals on 60% dusk ink inside tabs; lavender on POI plates; apricot on markers.

### Cards / Containers
- **Loot card:** rail ink, 12px radius, hairline border, 12px padding, floating-card shadow; a 48px marker preview that mirrors the marker's state (apricot ring, or ringless and greyscale when looted). For a grouped tile it becomes a list with a looted toggle per item, title + status line, then an action row (Mark looted primary, Take 1, Edit, Delete).
- **Dialogs:** card ink, 8px radius, hairline border, 24px padding, fade and 95% zoom over a black 80% scrim.
- **Menus:** card ink, 8px radius, 4px padding, 36px items, accent-ink highlight, apricot for checked items.

### Inputs / Fields
- **Style:** transparent fill, input-stroke border, 6px radius, 36px tall, 12px horizontal padding; apricot caret.
- **Focus:** apricot border with a 3px apricot ring at 50%.
- **Error / Disabled:** rust border and ring at 20%; disabled at 50% opacity.
- **Search trigger:** a field-styled button on 50% dusk ink in the top bar (256px from 768px) with a `/` kbd hint; hover tints the border apricot at 40%.

### Navigation
- **Top bar:** rail ink, 48px, hairline bottom border; panel toggle, wordmark (label type), map switcher (title type + chevron), run name with difficulty chip, search, sync status, travel toggle, overflow menu.
- **Panel tabs:** label type, 36px, muted bone at rest, bone on accent ink when active, each with a 14px icon and an optional count.

### Loot Marker (signature)
A 34px marker-ink squircle (9px radius) holding the item icon at 26px, ringed in 2px apricot, with an apricot quantity pill top-right. Hover scales to 1.15, selection to 1.22 with a 3px bone ring. **Looted** is the wash-out: no fill, no ring, a soft ink edge (`0 0 8px 2px` at 45%), icon at 55% opacity with full greyscale, quantity hidden, and a keylined 16px mint tick bottom-right. **Grouped** (markers within 22 screen px at the current zoom, recomputed on zoom): one tile with a stacked second tile behind and a bone count pill top-right. **Night map** (default on, `N`): the map image gets `brightness(.74) saturate(.85) sepia(.06)`. Transitions: 160ms `cubic-bezier(0.16, 1, 0.3, 1)` for scale, 240ms ease for opacity and filter.

### POI Plate (signature)
A dark ink name plate (92% alpha) with a 7px glacier pin dot, plate type in bone, glacier border at 55%, stash count in a lavender pill; hover or selection brings the border to full glacier and lifts the fill one step.

## Do's and Don'ts

### Do:
- **Do** build every surface from the dusk-ink family (hue 258) and separate layers by lightness step, not by new hues.
- **Do** reserve sunset apricot for loot still out there, the single primary action, and focus.
- **Do** draw looted things as the wash-out (fade, greyscale, soft edge, mint tick) rather than removing them.
- **Do** keep map overlays as dark ink plates with light borders so they read on the cream community maps.
- **Do** use the label treatment (650, 0.6875rem, +0.08em, uppercase) for control, field and group names, and `tabular-nums` for every count.
- **Do** keep transitions at 150-250ms for state changes only, and honour `prefers-reduced-motion`.

### Don't:
- **Don't** add a light theme or glare-white panels; the app is dark-only.
- **Don't** use colour to encode difficulty, navigation or decoration (The State-Only Colour Rule).
- **Don't** add glows or coloured shadows; shadows are dusk-tinted and only under floating elements.
- **Don't** reintroduce a paper grain or texture on the chrome; the painterly material belongs to the maps.
- **Don't** uppercase sentences, item names or notes.
- **Don't** add a web display face; the condensed HUD face for labels is pending the user's decision.
