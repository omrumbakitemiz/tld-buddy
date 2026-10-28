# Add-item lab: scoreboard

Three critics, each a fresh read-only agent, drove all four variants in Chrome against their own seeded Redis. They ran S1, S3, S4 and S5 plus a mistake and undo, read the saved data back, read the code, and scored the same 8 criteria from 1 to 10. Touch is out of scope (user, 2026-10-28), so the brief's "touch fallback" criterion was dropped. "Turkish Q friendliness" became "keyboard model (US layout)".

Critics: **Claude Opus 5.5** (`opus`), **Codex gpt-6.1-terra** (`terra`), **Cursor gemini-4-argon** (`gemini`). Builders: A Claude Opus 5.5, B Codex gpt-6.1-sol, C Claude Sonnet 5.5, D Codex gpt-6.1-terra. Two critic models share a model with a builder (opus/A, terra/D); neither scored its own variant highest.

## Round 1 (initial builds)

Variants reviewed at: A `8a3ad8c`, B `0d8bb10`, C `6abd0cf`, D `519c300`.

### Mean score per criterion (3 critics)

| Criterion | A Wheel | B Field note | C Rummage | D Satchel |
|---|---:|---:|---:|---:|
| Speed | 8.3 | 7.0 | 7.3 | 5.7 |
| Learnability | 6.3 | 8.3 | 8.3 | 4.7 |
| Error-proneness | 6.7 | 6.7 | 5.7 | 4.0 |
| Second-screen ergonomics | 7.3 | 8.0 | 7.3 | 5.3 |
| Keyboard model (US) | 7.7 | 8.3 | 7.0 | 4.0 |
| TLD art direction | 8.7 | 7.7 | 8.3 | 4.7 |
| Accessibility | 5.7 | 7.7 | 7.0 | 4.7 |
| Maintainability | 6.7 | 7.3 | 5.3 | 4.7 |
| **Mean** | **7.17** | **7.62** | **7.04** | **4.71** |

### Per critic (total out of 80)

| Critic | A | B | C | D | Ranking |
|---|---:|---:|---:|---:|---|
| opus | 60 | 55 | 59 | 32 | A > C > B > D |
| terra | 54 | 61 | 54 | 49 | B > A > C > D |
| gemini | 58 | 67 | 56 | 32 | B > A > C > D |

Legacy (the current dialog), rough overall: opus 4, terra 5, gemini 4.5 out of 10.

### Measured counts (critics' own, clicks + keys)

| | A | B | C | D | Legacy |
|---|---|---|---|---|---|
| S1, 9 items at one spot | 0 + 26–31 | 0 + 50–71 | 0 + 45, or 8 clicks + 24 keys mixed | 1 + 41–71 | ~20 + 114 (gemini) |
| S3, hacksaw + note | 1 + 16 | 1 + 19–21 | 1 + 19–20 | 3 + 18–20 | 2 + 18 |
| S4, firewood at 5 spots | 5 + 7 | 5 + 13–18 | 5 + 9, or 10 clicks + 0 keys | 5 + 2–6 | — |
| S5, add 2 more to a pile | 1 + 6–15 | 1 + 18–25 | 0–3 + 2–24 | 1–2 + 12–24 | — |

terra typed full item names everywhere (S1 ≈ 119 keys for all variants), so its counts measure the worst case, not learned paths.

### What the critics agreed on

- **A** is the fastest and has the best craft. It loses points because item order inside a group reshuffles as the run's habits change, which breaks muscle memory. Other issues: Shift+digit quantity, a ring hidden from screen readers, and a pile's existing items not shown.
- **B** is the most learnable, accessible and compact, and stays out of the map's way. It loses points for "pea → Peach Pie", one toast per item, an overloaded Enter, a false "Undone", existing items shown only as a count, and an edit-last that replays the whole visit.
- **C** shows best what is already at a spot and has the friendliest first use. It loses points for markers 7–9 landing on top of each other (no ring fix), digits swallowed as a quantity ("3 peaches" added 3 of the previous item), a stray map click moving the session, and no Undo on the closing toast.
- **D** is unbeatable for S4 route stamping and weak at everything else. It takes over 1/2/3 even when idle and when dialogs are open, right-click does nothing, Enter in the note does nothing, it silently disarms on alt-tab, and it looks like an unstyled prototype.

### Seam fixes made directly on `feat/add-item-lab` (commit `1b53952`)

Applied by the orchestrator, because several critics hit them in every variant:

- One ring layout for all variants, A's fixed concentric slots (6, 12, 18…). It replaces four different fixes.
- `amend()`, taken from A, to change what an open batch added while keeping undo exact.
- Right-click on a loot tile or place plate now adds at that tile's spot (it did nothing). `interceptTileClick` replaces the per-variant hooks from C and D.
- Spot snapping now reaches 40 map px or 28 screen px, whichever is larger.
- Ranking: name-prefix and word-prefix share a tier, then this run's history, then a small prior for commonly looted items. "pea" → Pinnacle Peaches.

## Round 2 (after one fix round)

The builders each got their consolidated critique in their own thread and pushed fixes. The same three critic models re-checked as new read-only agents. Each got the brief, its own round-1 scores and findings, and the builders' objections. Reviewed at A `d69af33`, B `3fbeead`, C `bb83e37`, D `df9fbfb`, after the seam re-ordered the loot groups so common loot sits in each group's first 8.

### Mean score per criterion, round 1 → round 2

| Criterion | A Wheel | B Field note | C Rummage | D Satchel |
|---|---:|---:|---:|---:|
| Speed | 8.3 → **9.0** | 7.0 → 7.7 | 7.3 → 7.7 | 5.7 → 7.0 |
| Learnability | 6.3 → 7.7 | 8.3 → **9.0** | 8.3 → 8.3 | 4.7 → 6.0 |
| Error-proneness | 6.7 → 8.0 | 6.7 → **8.7** | 5.7 → 7.3 | 4.0 → 5.7 |
| Second-screen ergonomics | 7.3 → 8.3 | 8.0 → **8.7** | 7.3 → 8.0 | 5.3 → 6.7 |
| Keyboard model (US) | 7.7 → **8.7** | 8.3 → **8.7** | 7.0 → 7.7 | 4.0 → 6.3 |
| TLD art direction | 8.7 → **8.7** | 7.7 → 8.3 | 8.3 → 8.3 | 4.7 → 7.0 |
| Accessibility | 5.7 → 7.7 | 7.7 → **8.0** | 7.0 → 7.7 | 4.7 → 6.3 |
| Maintainability | 6.7 → **7.7** | 7.3 → **7.7** | 5.3 → 6.7 | 4.7 → 6.7 |
| **Mean** | 7.17 → **8.21** | 7.62 → **8.33** | 7.04 → **7.71** | 4.71 → **6.46** |

### Per critic (total out of 80), initial → final

| Critic | A | B | C | D | Final ranking |
|---|---:|---:|---:|---:|---|
| opus | 60 → 67 | 55 → 64 | 59 → 63 | 32 → 47 | A > B > C > D |
| terra | 54 → 62 | 61 → 67 | 54 → 61 | 49 → 59 | B > A > C > D |
| gemini | 58 → 68 | 67 → 69 | 56 → 61 | 32 → 49 | B > A > C > D |

### Measured counts after the fix round (critics' own best paths, clicks + keys)

| | A | B | C | D |
|---|---|---|---|---|
| S1, 9 items at one spot | **0 + 26** (opus, gemini) | 0 + 49 | 0 + 44–47 | 1 + 48 |
| S3, hacksaw + note | 0–1 + 13–19 | 1 + 17 | 1 + 18 | 1 + 18 |
| S4, firewood at 5 spots | 5 + 7 | **5 + 5** (warm) / 5 + 9 | 5 + 9 | **5 + 3** (in a slot) / 5 + 7 |
| S5, add 2 more to a pile | **1 + 5–8** | 1 + 9–11 | 1 + 9–10 | 1 + 9–11 |

All four variants now save S1 correctly: 9 markers, right quantities, at least 12 map px apart, with S5 stacking 12 → 14 on the same marker (verified via `/api/data` by all three critics).

### Remaining findings after round 2, and what was done about them

- **A:** an open quantity or note field was dropped on Done or a click outside (gemini). **Fixed by the orchestrator** (`f167e11`, verified in the browser). "Again" offered an item you had just taken back (opus). **Fixed in the seam** (`73bf3bd`). Open: the wheel plus plate still covers ~300 px around the spot (it fades after a pick), and there has been no real screen-reader pass.
- **B:** Tab is trapped in the line, so the Discard and Remove links can't be reached; the toast says "Added 1 items"; "Before this visit" is clipped at 6 items with no count.
- **C:** a post-tick quantity followed within 4 s by a digit-first search (`mat⏎12`, then `3 pea`) resets Wood Matches to ×1 and searches "123 pea". The panel is wide when the side panel is also open.
- **D:** the LootCard covers the tray. Typing `12 mat` after alt-tab at a held spot arms slot 1. One toast per item, and its Undo removes the whole held visit. Existing loot at a held spot is not shown.

### Bias check

Two critic models also built a variant: opus built A, terra built D. Each rated its own model's variant higher than the other two critics did: opus put A first, and terra gave D its best score (59 against 47 and 49). Without them, the neutral critic (gemini) has B 69 and A 68, a tie. The recommendation below does not rest on either self-rating.

## Recommendation

**Ship A, the Wheel**, with the current dialog kept as a fallback, and fold in the runners-up's strengths listed below. B is a very close second: by the panel's mean (8.33 against 8.21) it is ahead, and it is the safer, more learnable choice.

Why A over B, for this user:

- **Speed is the brief's first word, and the gap is large.** S1 is 26 keys against B's 49, and S5 is 5–8 against 9–11. Each scenario repeats dozens of times per run. Learnability is a one-time cost for one long-term user.
- **One hand stays on the mouse, one on the left of the keyboard.** The player is already pointing at the spot. `A` opens the wheel, `1`–`8` pick, and `Shift`+digits set quantity, all on the WASD side, so neither hand leaves its place. B needs both hands on the keyboard to type names.
- **It is The Long Dark's own idiom.** The game's radial menu (hold Space) is what the wheel copies, and it scored highest on art direction in both rounds.
- **It improved most where it was weak.** Learnability rose 6.3 → 7.7, errors 6.7 → 8.0 and accessibility 5.7 → 7.7. The fixed group order, the "already here" plate, named slices and a visible `x` quantity field took away the round-1 objections.

What the runners-up do better, to fold into A next:

- **From B:** never losing a typed draft (Esc, a map click or a drag keeps it); showing "Before this visit" and "This visit" as separate lists; empty-line quick picks.
- **From C:** the "Log loot here · A" chip under a selected place; the "On this spot" list with a looted toggle per item, as an expandable section of the plate; likely items per place type for slot 8.
- **From D:** nothing that A doesn't already cover. Right-click plus `Space` gives S4 in 5 clicks and 7 keys. A persistent stamp mode added more mode errors than it saved keys.
