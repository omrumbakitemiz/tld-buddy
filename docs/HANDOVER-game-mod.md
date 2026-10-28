# Handover: TLD game mod + live overlay

Planning was done on the MacBook. Implementation continues on the **Windows gaming PC**, where The Long Dark, MelonLoader and the .NET SDK are installed. Read this first, then `PRODUCT.md` and `README.md`.

## Decisions (made by the user, 2026-10-28)

- Game-side code supports **Windows only**. No macOS/Linux fallbacks.
- **Full modding is OK**: MelonLoader, Harmony patches, in-game UI, reading any game state (including "cheaty" info such as container contents). It is a single-player game played by the owner.
- MelonLoader (Il2Cpp) is installed. The .NET SDK is installed; add missing workloads/packages as needed.
- The user types on a US keyboard and uses TLD Buddy on a second desktop monitor. Touch UI is not a priority.

## Goal

Connect the running game to TLD Buddy so the app knows where the player is and what is in the world, and show useful info in-game.

## Target architecture

```
TLD + MelonLoader mod (C#, Harmony)
  ├─ in-game HUD (minimap / waypoints / toasts)
  └─ HTTP/WS client ──► Pi server (token auth, LAN/tailnet URL)
                           ├─ Redis (runs, markers: same document as today)
                           └─ SSE ──► browser tabs (2nd monitor, phone)
```

- The mod is the source of truth for **world facts** (position, scene, containers, items, pickups).
- The app stays the source of truth for **user notes, runs, POIs**.
- The mod talks to the Pi over the LAN or tailnet, not through the public Cloudflare Access URL (Access blocks non-browser clients). It authenticates with a dedicated token, not the app password cookie.
- Fallback bridge (simpler, PC only): the mod hosts `ws://127.0.0.1:<port>` and the browser tab connects to it directly. Chrome may prompt for local network access.

## Feature ideas, roughly in priority order

1. Live "you are here" marker with a heading arrow; the app switches to the current region automatically.
2. Hotkey in-game: "mark here" (drops a marker at the player position).
3. Pickup/drop hooks: picking up an item marks the nearest marker looted; dropping items records a stash.
4. Container/item scan of the loaded scene to fill in loot markers automatically (position, type, searched state, contents).
5. Run identity (save slot, difficulty), so the app selects the run automatically.
6. In-game HUD: minimap corner, compass strip, waypoints to app POIs/stashes, "stash nearby" toasts.
7. Breadcrumb trail per run; time/weather/condition shown in the side panel.

## Coordinate calibration (needed for 1–4)

- The map images are static JPGs; sizes are in `public/data/maps.json` (`imageWidth`/`imageHeight`, separate default/interloper artwork).
- Use one **affine transform per map** (game world x/z → image pixel), fitted from ≥3 reference points.
- Reference points: have the mod export the world positions of known landmarks (scene transitions, buildings) and match them to POIs in `public/data/pois.json`, or click known spots by hand.
- Commit the calibration as static data. It is fixed per map, not per run.
- Scene names (e.g. `LakeRegion`) must map to app map ids (e.g. `mystery-lake`). Build that table in the spike.

## Existing app (relevant bits)

- Nuxt 4 / Vue 3 / Leaflet (image CRS) / shadcn-vue / Tailwind 4. Redis on a Raspberry Pi via Docker Compose (`deploy.sh`).
- Server API: `server/api/data.get.ts`, `data.put.ts` (whole user document), auth in `server/middleware/auth.ts`, storage in `server/utils/appDataStore.ts`.
- Client state: `app/composables/useAppStore.ts`; map: `app/components/InteractiveMap.vue`.
- Saved Redis data must keep loading. Shape changes need a migration.
- Tests: `pnpm test` (`scripts/test-app-data.ts`).

## Next step: spike (do this first)

Create a mod project (suggested location: `mod/` in this repo, or a sibling repo; decide with the user):

1. Class library targeting the framework MelonLoader expects for this TLD build. Reference `MelonLoader/net6/MelonLoader.dll`, `0Harmony.dll`, and the generated `MelonLoader/Il2CppAssemblies/*.dll` (at least `Assembly-CSharp.dll`, `Il2Cppmscorlib.dll`, `UnityEngine.CoreModule.dll`). Point to them via a `TldDir` MSBuild property, not committed DLLs.
2. `MelonMod` that logs to the MelonLoader console, about once per second:
   - active scene name
   - player world position + heading (`GameManager.GetPlayerTransform()`; verify the exact API against the Il2Cpp assemblies)
   - count of containers in the scene (`Container` components; verify the type name)
3. Post-build step copies the DLL into `<TLD>/Mods/`.
4. Success = stable, sensible numbers while walking around Mystery Lake. Then: scene→map table, calibration for one region, then the bridge and live marker.

## Open questions for the user

- Mod location: `mod/` folder in this repo vs separate repo.
- Bridge: relay through the Pi (multi-device, needs a token + server endpoint) vs localhost WebSocket (PC only). The recommendation was the Pi relay.
- LAN/tailnet URL of the Pi as reachable from the Windows PC.
