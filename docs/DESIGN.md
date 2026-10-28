# TLD Buddy: design direction

You asked for the app to follow The Long Dark's own art direction ("pastel", though you weren't sure that was the right word). This page covers what the research found, what the style is called, and how it became the app's tokens. The tokens live in `app/assets/css/tailwind.css`.

## What the style is called

There is no official name. Hinterland answered exactly this question on the Steam forums:

> "There is no 'name' for this art style, at least not that we know of. Some have called it 'painterly'. … We wanted the game to feel like playing a water-colour painting." (Hinterland Studio, [Steam discussion](https://steamcommunity.com/app/305620/discussions/0/613937942959107644/))

They also confirmed that it is **not cel-shaded**. The words that describe it best:

- **Painterly**: the studio's own word. Creative director Raphael van Lierop: "We've adopted a very storybook, painterly art style… we emphasise bright colours, and have these very dramatic sunsets." ([PC Gamer interview](https://www.pcgamer.com/uk/the-long-darks-creative-director-explains-why-it-doesnt-need-zombies))
- **Water-colour / storybook**: the stated feeling to aim for (above). West Studio, which made concept art for the story mode, describes the direction set by art director Hokyo Lim as "careful distillation of shape, color and line" with "a quiet, unassuming expressiveness", like "playing out a living storybook" ([West Studio](https://www.weststudio.com/project/thelongdark)).
- **Impressionist / Canadian landscape painting**: a fan and critic reading, not an official one. Players compare the look to the Group of Seven (Lawren Harris's mountains and ice, Tom Thomson) and to Emily Carr. Kill Screen called it "stark, spare, with a painterly sense of color" ([Kill Screen](https://killscreen.com/previously/tag/great-outdoors/); [Hinterland forums thread](https://hinterlandforums.com/forums/topic/22008-art-history-and-tld/)).

"Pastel" is close: the skies at dawn and dusk *are* pastel (peach, lavender, pale teal) over deep blue-slate shadows. The precise term is **painterly (water-colour) storybook style**.

## The game's HUD

From a design breakdown of the HUD ([Game Developer](https://www.gamedeveloper.com/design/long-dark-survival-game-hud-ui)):

- Two-colour UI: **white** for elements, **black** for contrast over both bright and dark scenes.
- Accent colours are **cool, muted and used sparingly**. **Red** means danger and **yellow** means warning; the rest stays white.
- Labels are mostly **uppercase** in a custom typeface; regular-weight text is for details.
- Minimalism: icons over text, nothing persistent that doesn't need to be.

## Translation into the app

The app sits next to the game on a second monitor, usually in a dark room. So it's always dark, and it borrows from the game only what it can use on a working screen: palette, type voice, density, and one signature move. Navigation and controls stay standard (shadcn-vue / reka-ui).

| Game source | App token | Value | Used for |
|---|---|---|---|
| Painted night/dusk sky (deep blue-slate) | `--background` | `oklch(0.205 0.028 258)` | App ground |
| Same, a step deeper | `--rail` | `oklch(0.175 0.026 258)` | Top bar, side panel |
| HUD white (warm, like snow under lamplight) | `--foreground` | `oklch(0.945 0.014 85)` "bone" | Text, POI labels |
| "Dramatic sunsets" (apricot) | `--primary` / `--loot` | `oklch(0.82 0.105 58)` | Loot that's still there, primary actions, focus |
| Aurora (pale mint-teal) | `--looted` | `oklch(0.84 0.085 170)` | Looted tick, "looted" text |
| Pastel dusk lavender | `--secondary` | `oklch(0.30 0.04 285)` | Stash counts, secondary buttons |
| Pale glacier blue | `--place` | `oklch(0.83 0.07 230)` | Places (POIs) |
| HUD red = danger | `--destructive` | `oklch(0.64 0.17 27)` | Delete, errors |
| HUD yellow = warning | `--warning` | `oklch(0.84 0.13 85)` | Offline, no run selected |

**Paper texture: dropped.** A faint noise grain was tried on the panels, but at a strength that doesn't hurt legibility it was invisible, so it was removed rather than kept as a token that does nothing. The painterly material comes from the maps themselves.

**Type.** A plain system sans for everything you read (Operate surface, no web-font cost). Open item: the finish review recommends a self-hosted condensed HUD face for `.hud-label` and POI plates; not done yet. The game's voice comes from `.hud-label`: uppercase, 650 weight, +0.08em tracking. It is used for the wordmark, tab names, section labels and POI labels. Numbers use `tabular-nums`.

**Signature move: the wash-out.** Remaining loot is a crisp dark-ink tile with an apricot ring and a quantity badge. When you mark it looted, it doesn't disappear: the tile desaturates and fades into the painted map (`grayscale + opacity .62`), the border turns dashed, and a pale mint tick appears. Looted items stay readable as history without competing with what's left. `H` hides them completely.

**Map treatment.** The community maps are bright cream paper with dense coloured icons. So markers and POI labels are *dark* ink plates with light borders, which keeps them legible on cream. A soft dusk vignette at the edges blends the painting into the app ground.

**Contrast** (WCAG, computed from the OKLCH values): bone on dusk is 15.3:1, and muted text is 8.4:1 on the ground and 7.6:1 on cards. Apricot on the rail is 10.6:1, dark text on apricot buttons 10.1:1, and mint on the rail 12.0:1. Rust-red on the rail is 5.2:1.

**Difficulty** is shown as a neutral bone chip with 1–5 pips (pilgrim → misery), not colour. Colour stays reserved for loot state, places and danger/warning, as in the game's HUD (`app/components/DifficultyChip.vue`).

**Motion.** 150–250 ms state transitions only: marker scale on hover and select, the looted wash, panel and dialog fades. Everything respects `prefers-reduced-motion`.
