# Adding items to the map: research

Researched on 2026-10-28 for the add-item redesign (`feat/add-item-lab`). Sources are linked inline. The Fandom wiki and its mirrors block automated fetches (HTTP 402 / bot wall), so wiki facts below come from search-result extracts of those pages plus the app's own catalogue (`public/data/*.json`, imported from the same wiki). Where a claim rests on general game knowledge rather than a source, it says so.

## 1. Item pool

### Size and categories

`public/data/items.json` holds **667 items** (PRODUCT.md still says 625; the import grew). 666 have an icon. The import crawled the wiki's top-level categories (`scripts/import-wiki-items.ts`), which gives 7 categories:

| Category | Count | What is really in it |
|---|---|---|
| Collectible | 253 | Notes, memos, journal pages (~87), keys (27), IDs, polaroids, blueprint cards, story items. Almost never "loot" in the stash-tracking sense, but keys and blueprint cards matter. |
| Food | 118 | Canned/packaged food, drinks (sodas, coffee, tea, water), raw/cooked meat and fish, recipes (pies, stews), carcasses/quarters. |
| Clothing | 106 | Every slot: hats, scarves, coats, sweaters, shirts, pants, socks, boots, gloves, plus crafted hide gear and named story clothing. |
| Tool | 88 | Knives, hatchets, prybar, hacksaw, rifles, revolvers, bows, arrows, **ammunition**, flares, cooking pots, sewing kit, whetstone, bedrolls, fishing gear. |
| Resource | 46 | Cloth, scrap metal, hides/pelts/gut (fresh and cured), saplings, lichen, mushrooms, casings, bullets, car battery. |
| Fire/Light | 35 | Matches, firestriker, firewood, coal, accelerant, lantern fuel, torch, lens, newsprint, **and the skill books** (Frontier Shooting Guide etc.) and **Cash**, because the wiki files them under fire starting. |
| Medical | 21 | Antiseptic, bandage, painkillers, antibiotics, teas, vitamin C, water tablets, heat pack, stim. |

Consequence for design: the catalogue's categories are noisy (books and cash under Fire/Light, ammo under Tool). A UI that leans on category browsing will feel wrong in places. Search and "what I used before" carry more weight than the category tree. A small curated quick-pick set (see §4) beats exposing all 7 categories as primary navigation.

### Stackable vs single, condition, quantity

From the game (general knowledge, consistent with the wiki extracts below):

- **Stack as a count** in the backpack: matches, ammunition, arrows, firewood/sticks/coal, cloth, scrap metal, tinder, newsprint, bandages, painkillers, antibiotics, water, many cans of the same food, salt, gut, saplings. A container commonly holds 2–12 of these.
- **Single, with condition**: clothing, tools, weapons, books, keys, collectibles, bedrolls, lanterns.
- **Condition** runs 0–100 %; at 0 % an item is ruined and can only be harvested or discarded. Tools lose condition only through use; food, clothing and some materials also decay over time, faster on higher difficulties ([Decay, wiki extract](https://breezewiki.discard.no/thelongdark/wiki/Decay)).
- **Weight** is per unit, and small items (a bullet, a casing at 0.005 kg) display as 0.00 kg ([Revolver Shell Casing](https://thelongdark.fandom.com/wiki/Revolver_Shell_Casing)); firewood is 0.5 kg per piece ([Cedar Firewood](https://thelongdark-archive.fandom.com/wiki/Cedar_Firewood?oldid=3630)).

The app's marker already models this: `quantity` (default 1) plus an optional note. Condition is not tracked and should stay out of the fast path: players remember "2 boxes of matches", not "matches at 64 %". If condition ever matters ("ruined parka, harvest later"), the note covers it. **Quantity must be a one-key edit** in any concept, because stackables are exactly the items players log most.

### What players realistically log

From the app's purpose (PRODUCT.md: "record items spotted at map positions, mark them looted once taken, keep track of what was stashed") and how the game plays:

1. **Things left behind on purpose** because of weight or need: spare rifle ammo, extra hatchet, a second prybar, cans of food in a farmhouse, firewood, cloth. This is the bulk.
2. **Rare/high-value finds** to come back for: rifle, revolver, bow, hacksaw, magnifying lens, firestriker, quality tools, skill books, expedition parka, mukluks, gauntlets, moose-hide satchel, flare gun ammo, insulated flask.
3. **Stashes**: a pile of supplies deliberately dropped at a base (one spot, many items, often big quantities).
4. **Keys and story items** occasionally (rare; Collectibles are excluded from the picker's default view today, which is right).

Nobody logs every cup of coffee in every drawer. A realistic "logged a container" entry is 3–9 distinct items, most of them stackable.

### High-value / rare vs common clutter

- **Rare / high value** (players will want these fast, and they're exactly what's worth remembering): weapons and ammo, hacksaw, prybar, quality tools, whetstone, firestriker, magnifying lens, books, mukluks, gauntlets, expedition parka, moose-hide satchel, insulated flask, distress pistol. Safes "have some of the highest loot tables in the game" and can hold rare items like a Can of Gunpowder, Mukluks or Gauntlets ([wiki/forum extract on containers](https://thelongdark.fandom.com/wiki/File_Cabinet); [Steam discussion](https://steamcommunity.com/app/305620/discussions/0/4515506448139452326)). Hidden caches with orange lids hold high-level loot on all difficulties (same sources).
- **Common clutter**: sodas, crackers, coffee, tea, newsprint, sticks, cloth, recycled cans, matches. Players log these only in bulk ("12 cans of food in the farmhouse").
- On **Interloper**, some items are not spawned at all (firestriker, red flares) and prepper caches are never fully stocked ([Steam: Interloper loot](https://steamcommunity.com/app/305620/discussions/0/4036977035352487676); [SteamDB patch notes](https://steamdb.info/patchnotes/10143117)). The run's difficulty is known to the app, so a smart picker could down-rank items that can't exist on that difficulty. (Nice-to-have; not required.)

### Loot is not fixed

Loot spawns carry randomness: Hinterland's own patch notes warn that expecting things "to appear in the same place, or quantity" is not a safe assumption ([SteamDB patch notes](https://steamdb.info/patchnotes/10895031)). Some placements are static (e.g. the Prepper's Abandoned Cache layout in Pleasant Valley, per the [wiki](https://thelongdark.fandom.com/wiki/Prepper%27s_Abandoned_Cache)), and prepper bunkers sit in 9 set locations with 3 fully stocked at random ([Steam discussion](https://steamcommunity.com/app/305620/discussions/0/3288067088108130129)). This is the whole reason a per-run memory app is useful, and it argues **against** pre-filled "this building contains X" data: likely-item suggestions are fine as a hint, never as a claim.

## 2. Regions and map types

### What the app covers

`public/data/maps.json` has **21 maps**, taken from HokuOwl's Steam guide "Updated Region Maps" ([Steam guide 3255435617](https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617), see `scripts/import-steam-maps.ts`), which carries a spoiler warning for Survival mode:

- **16 regions**: Mystery Lake, Coastal Highway, Pleasant Valley, Desolation Point, Timberwolf Mountain, Forlorn Muskeg, Broken Railroad, Mountain Town, Hushed River Valley, Bleak Inlet, Ash Canyon, Blackrock, and the Far Territory DLC regions Transfer Pass, Forsaken Airfield, Zone of Contamination, Sundered Pass.
- **5 transition zones**: Ravine, Winding River, Crumbling Highway, Keeper's Pass, Far Range Branch Line (DLC).

The wiki's Locations page also splits areas into main regions, transition regions and the Far Territory ([Locations](https://thelongdark.fandom.com/wiki/Locations)). *Tales from the Far Territory* added Transfer Pass as a hub and the Far Range Branch Line transition ([Hinterland news](https://www.thelongdark.com/?p=4206)); Part Five "Last Horizon" (24 June 2024) added Sundered Pass, reached from the Zone of Contamination ([Hinterland](https://thelongdark.com/?p=4702)).

### Interiors, caves, mines

In the game, building interiors, mines and larger caves are separate scenes behind a loading door; small caves and huts are open. The community maps draw each region as **one top-down image**; interiors are not separate maps. So "the farmhouse" is one small area on a 4000+ px map. `pois.json` has 355 POIs with types `outdoors` (88), `landmark` (57), `cave` (44), `residential` (39), `industrial` (21), `sporting` (9), plus a long tail of inconsistent labels (`Building`, `Cave`, `store`, `trailer`, 80 untyped).

### Scale and density

- Map images are ~4000×3100 to 4235×4650 px. A building is ~40–120 px across at native zoom. POIs per map: 2 (Ravine) to 33 (Pleasant Valley).
- The maps are dense with coloured icons; markers are dark ink tiles grouped within 22 screen px (`InteractiveMap.vue`).
- A marker position therefore only needs **building-level precision** (± 20 map px). Players don't know where inside the house a drawer is on a top-down map. This makes "pick a spot once, then add many things there" safe.

### Where loot clusters

- **Buildings**: houses, farmsteads, camp offices, fishing huts, lodges, stores, the dam, the prison. Containers inside: drawers, cabinets, lockers, file cabinets (4 drawers, up to 10 kg each per the [wiki](https://thelongdark.fandom.com/wiki/File_Cabinet)), kitchen cupboards, fridges, wardrobes, safes, vegetable racks ([Carrot](https://thelongdark.fandom.com/wiki/Carrot)).
- **Vehicles**: car trunks and glove boxes along highways and roads.
- **Corpses**: frozen bodies in the snow, often with loot scattered around them (the Lonely Homestead area has several; [wiki](https://thelongdark.fandom.com/wiki/Lonely_Homestead)).
- **Caches**: prepper bunkers, orange-lid hidden caches, Forest Talker and convict caches ([Forest Talker Supply Caches](https://thelongdark.fandom.com/wiki/Forest_Talker_Supply_Caches), [Convict Caches](https://thelongdark.fandom.com/wiki/Convict_Caches)), plane-crash cargo containers on Timberwolf Mountain ([Cargo Container](https://thelongdark.gamepedia.com/Cargo_Container?oldid=7073)).
- **Beachcombing**: Coastal regions spawn fresh items on shorelines after storms ([Beachcombing](https://thelongdark.fandom.com/wiki/Beachcombing)).

So most entries land on a POI (building/cave) or right next to one. POI pins exist in the app already, but only for POIs the user enabled and pinned.

## 3. Interaction precedents

- **The game itself uses a radial menu.** Holding **Space** (PC) opens a set of wheels by category (light sources, weapons, campcraft, food, drink…), "a quick alternative way to select items in your inventory" ([Radial Menu](https://thelongdark.fandom.com/wiki/Radial_Menu)). Keys 1–4 bypass it for light/weapon. Players of this game already have radial muscle memory; some find it awkward ([Steam thread](https://steamcommunity.com/app/305620/discussions/0/357285562495578535)).
- **Pie / marking menus**: slices are big and near the pointer, so Fitts's law favours them ([Pie menu](https://www.wikipedia.org/wiki/Pie_menu)). Experts stop looking and just flick ([Kurtenbach & Buxton](https://www.billbuxton.com/MMExpert.html)). Breadth 8 caps practical depth at 2; they suit 3–12 items and are poor for long dynamic lists ([Autodesk Research: limits of hierarchic marking menus](https://www-pt.autodesk.com/research/publications/the-limits-of-expert); [simple marking menus](https://www.dgp.toronto.edu/~ravin/papers/uist2004_simplemm.pdf)). 667 items will never fit a pie; a pie needs a curated top level plus a search escape hatch.
- **Command palettes**: show recents on an empty query; rank exact prefix matches above fuzzy ones; use **frecency** (frequency × recency) so one odd pick doesn't jump to the top ([21st.dev](https://21st.dev/blog/react-command-palette-components); [frecency](https://concepts.dsebastien.net/concept/frecency/); [WezTerm palette](https://wezfurlong.org/wezterm/config/lua/keyassignment/ActivateCommandPalette.html)).
- **Stamp / brush tools** (map editors, design tools): pick a thing once, click many spots. Fast for "same item again", needs a clear mode indicator and an obvious exit.

## 4. Real gameplay add-flows

Each scenario below is used to count clicks and keys for the current flow (§5) and for every concept in CONCEPTS.md.

| # | Scenario | Shape |
|---|---|---|
| S1 | **Just looted a farmhouse, log 9 things fast.** e.g. 12 matches, 3 cans of peaches, 2 rifle ammo boxes, hatchet, sewing kit, wool toque, 2 cloth, 5 firewood, antiseptic. | 1 spot, 9 items, 5 of them with quantity > 1 |
| S2 | **Stash at a spot.** Drop 20 rifle ammo, a rifle, 6 cans and 10 firewood at a base. | 1 spot, 4 items, big quantities; may be a pinned POI |
| S3 | **Spotted a rare item, come back later.** A hacksaw in a car trunk on the highway. | 1 spot, 1 item, often with a short note |
| S4 | **Same item again.** Firewood piles / cloth / matches at several spots along a route. | N spots, 1 item |
| S5 | **Batch add a whole container.** A file cabinet: 3 items, then the next drawer… | 1 spot, items arrive one by one as the player reads the game screen |

Common traits:
- The player's hands are mostly on the **game**. They glance at the second monitor, act, and go back. Each add should survive being interrupted halfway (alt-tab back to the game, then return).
- The **spot** is decided once per container/building; **items** are the repeated part.
- Typing a few letters is fast on a keyboard; scanning a 400-tile grid is slow.
- Input: the user plays on a desktop with mouse and a **US keyboard** (corrected by the user on 2026-10-28; an earlier brief said Turkish Q). Touch UI is **out of scope** for now.

## 5. The current add flow

Code: `app/app.vue` (`startAddLoot`, `onRequestAddMarker`, `onSaveMarker`), `InteractiveMap.vue` (map click / contextmenu), `MarkerDialog.vue`, `ItemPicker.vue`.

**Model:** pick a spot first, then a centred modal dialog with a search box, 7 category chips, "Used often this run" tiles and a scrolling icon grid. Type a name, `Enter` adds the top match to a list with a quantity stepper, `Enter` on an empty search saves. Multiple items at one spot are spread on a 12 px ring and drawn as one grouped tile.

Ways to start: `A` then click the map; Shift-click; right-click; long-press on touch; the floating "Add loot" button; the palette's "Add loot" action.

Counts (desktop, keyboard path; "5 chars" ≈ typing enough to make the item the top fuzzy match):

| Scenario | Clicks | Keys | Notes |
|---|---|---|---|
| S3 rare item | 1 (right-click) | ~5 + Enter + Enter = 7 | +Tab + note + Ctrl+Enter for a note (~15 more) |
| S1 farmhouse ×9 | 1 + 5 quantity edits (click field, type, or click + N times) ≈ 6–25 | ~9×6 + 1 ≈ 55 | Quantity has no key: mouse needed for each stackable |
| S2 stash ×4 | same pattern, ≈ 1 + 4–8 | ~25 | Or the POI route: select pin → Places tab → Stash → pick (stashes are a separate model) |
| S4 same item ×5 | 5 × (1 + 2 via "Used often" tile + Save) = 15 | 0 | or 5 × (right-click + 7 keys). No repeat-last, no stamp |
| S5 container in drawers | 1 per batch; each new drawer at the same spot needs another right-click near the old tile | | Re-adding to an existing spot creates a new ring of markers |

Friction found:
1. **The modal covers the map.** You lose the spot you just clicked and can't see what's already there (did I log this farmhouse already?).
2. **Quantity is mouse-only.** Stackables dominate real logging, and each needs the stepper.
3. **No "same again".** No repeat-last-item, no stamp mode; "Used often" helps but sits under the category chips.
4. **The spot is forgotten after save.** Adding a second batch to the same building means clicking the map again, and the new ring doesn't merge with the old one.
5. **Category chips are noisy** (books in Fire/Light, ammo in Tool), and 400+ tiles in the default grid are not scannable.
6. **Enter-Enter is clever but invisible**: the hint is a footnote, and a stray second Enter saves early.
7. **Ranking ignores prefix**: Fuse's fuzzy score can put "Rifle Shell Casing" above "Rifle" for "rifle"; frecency only shows on an empty query.

What already works and should be kept: spot-then-items order, fuzzy search with Enter-to-add, per-run frequency, grouped tiles, `A` / right-click / long-press entry points, dark ink styling.
