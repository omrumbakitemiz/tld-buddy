# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One player of *The Long Dark* (Hinterland Studio's survival game), plus anyone they share the password with. They use TLD Buddy **while playing**, mostly on a **second desktop monitor** with mouse and keyboard. Tablet and phone still have to work. They look at it between in-game actions: glance, find a spot, record what they saw or took, go back to the game.

## Product Purpose

A personal map companion: browse the community region maps, pin the game's Points of Interest, record items spotted at map positions, mark them looted once taken, and keep track of what was stashed at which location, all separately per run (save/playthrough). It succeeds when recording or checking a piece of loot takes one or two actions and no data ever goes missing.

## Positioning

Not a wiki or a static map site: it is the player's own memory of their own runs, synced across the devices next to the game, on top of the best community maps.

## Operating Context

- Used beside a running game, often in a dark room; the game has focus most of the time.
- Desktop second screen is primary (mouse, keyboard, shortcuts); tablet/phone are secondary.
- Multiple devices may be open at once (PC + phone), all saving to the same Redis document.
- Self-hosted on a Raspberry Pi (Docker Compose + Redis), reachable on the LAN, on the tailnet, and publicly behind Cloudflare Access at tld.immino.dev.

## Capabilities and Constraints

- Runs with difficulty (pilgrim → misery); difficulty picks the default or interloper map artwork.
- 21 region/transition maps, 625 items, 355 POIs, 23 map connections as static JSON (public/data).
- Markers: item + quantity + optional name/note at a map position, per run; looted on/off (confirmed by the user: a toggle per marker, older data reads as "still there").
- POIs: enable per region, pin a position on the map (pins are global across runs), stash items there (per run).
- Travel mode: two maps side by side, with suggestions for connected maps.
- Recent maps list.
- Single shared password, cookie session.
- Existing saved data in Redis must keep loading; shape changes need a migration.

## Brand Commitments

- Name: **TLD Buddy**.
- The look follows **The Long Dark's own art direction** (the user's explicit request), not a generic "cold wintry" theme. Research and translation: docs/DESIGN.md.
- Has to stay readable on a dark second monitor, with looted and remaining states clear at a glance.

## Evidence on Hand

- Community region maps: public/maps/*.jpg (light cream maps with dense coloured icons).
- Item icons from the TLD wiki: public/items/*.png.
- No testimonials, users or metrics exist; none may be invented.

## Product Principles

1. The map is the product: chrome gets out of its way.
2. One action to record, one action to tick off.
3. Never lose the player's data, even across devices, crashes and flaky Wi-Fi.
4. Glanceable first: state is visible without opening anything.
5. Keyboard-first on desktop, touch-safe everywhere.

## Accessibility & Inclusion

- Readable in a dark room: WCAG AA contrast for text, no glare-white panels.
- Every action reachable by keyboard; icon-only controls carry accessible names.
- Touch targets ≥ 40px on touch devices.
- Respect `prefers-reduced-motion`.
