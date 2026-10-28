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

## Round 2 (after the fix round)

_Pending._
