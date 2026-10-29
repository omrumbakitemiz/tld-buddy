# TLD Buddy game mod

MelonLoader (Il2Cpp) mod for The Long Dark. Windows only. See `docs/HANDOVER-game-mod.md` for the plan.

## Requirements

- The Long Dark with MelonLoader 0.7.x installed.
- In the game folder, rename MelonLoader's `version.dll` to `winhttp.dll`. On current Windows 11 builds the game loads the system `version.dll` and skips the proxy. Reinstalling or updating MelonLoader puts `version.dll` back.
- .NET 6 runtime (`winget install Microsoft.DotNet.Runtime.6`). MelonLoader needs it at runtime.
- Launch the game once with MelonLoader so it generates `MelonLoader/Il2CppAssemblies`. The log ends with "Assembly Generation Successful!".
- .NET SDK 8 or newer to build (the project targets `net6.0`, which is what MelonLoader loads).

## Build

```powershell
dotnet build mod/TldBuddy.Mod
```

The build copies `TldBuddy.dll` into `<TLD>/Mods/`. Close the game before you build, because a running game locks the DLL.

`TldDir` defaults to `D:\SteamLibrary\steamapps\common\TheLongDark`. You can override it in any of these ways:

- `dotnet build mod/TldBuddy.Mod -p:TldDir="C:\path\to\TheLongDark"`
- set the `TLD_DIR` environment variable
- create `mod/TldDir.props.user` (git-ignored):

  ```xml
  <Project>
    <PropertyGroup>
      <TldDir>C:\path\to\TheLongDark</TldDir>
    </PropertyGroup>
  </Project>
  ```

## Live position bridge

About once a second, the mod posts the player's scene and position to `POST <ServerUrl>/api/live/v1/state` with `Authorization: Bearer <Token>`. The app streams it to signed-in browsers (`/api/live/v1/stream`). It shows a "you are here" arrow and switches to the region you are in. Indoors, the marker sits on the door you entered by.

1. On the server, set `MOD_TOKEN` in `.env` (e.g. `openssl rand -hex 32`) and run `./deploy.sh`.
2. In `<TLD>/UserData/MelonPreferences.cfg`:

   ```toml
   [TldBuddy]
   ServerUrl = "http://192.168.1.133:4000"   # LAN address; Cloudflare Access blocks the mod
   Token = "<same value as MOD_TOKEN>"
   ```

Optional settings in the same section:

- `MarkKey = "F4"`: F1–F12, a letter or a digit.
- `RunInBackground = true`: keep the game running while TLD Buddy has focus.

### Runs follow the save

The mod also sends which save you're playing (its name and experience mode), plus the in-game day and time, weather, temperature (feels like) and your condition. The time, weather and condition show at the top right of the map.

- A run linked to the save opens by itself when you load that save.
- With no linked run, a bar asks you to pick one: use the current run, or start a new run named after the save, with the save's difficulty.
- Marks, pickups and drops go to the run of the save they happened in, even if you have another run open. Events from a save no run is linked to wait until you link one.
- To unlink, edit the run in Runs.

A dotted trail on the map shows where you walked in that save: the server keeps a point every 5 m (in Redis, per save, up to 20,000 points). It survives closing the game and the browser. The line breaks indoors and at fast travel. Turn it off with "Show trail" in the ⋮ menu. "Clear items" on the run also clears its trail.

### Mark here

Press the mark key in game (default F4) while aiming at an item. A marker for it appears in the current run where the item lies (at your position when you aim at nothing), and the game shows "TLD Buddy: marked Hatchet".

- Items are matched to the app's item list by display name, then by prefab name (`GEAR_Hatchet`).
- The marker remembers the game object. Pressing the key again on the same item adds nothing ("Already on the map" in TLD Buddy), and only picking up that object loots it. Items you dropped have no object id: the mod gives them one when you mark them, so they stay tracked when you move them. Marking a marked object again somewhere else moves its marker ("Moved" in TLD Buddy). Before an item has an id, a mark within 1.5 m of its stash, or of a mark from the last two minutes, counts as a repeat.
- If you aim at nothing, or at something the app doesn't know, you get an "Unsorted loot" marker. Its note records what the game called it.
- Indoors, the marker goes on the door you came in by, with an "Inside Camp Office" note.
- The server holds marks until a TLD Buddy tab picks them up, so marks made with no tab open still arrive.

### Pickups and drops

The mod also reports what you pick up and put down, without a key press:

- **Pickup** (from the ground or a container): the nearest marker for that item within 20 m is set to looted. If the marker holds more than you took, its quantity goes down instead. Indoors, only markers noted as inside the same building count, and a stash in the container you took from comes first.
- **Drop** (on the ground, or into a container): a "Dropped" marker at your position, or "Stored in Locker" for a container. Putting more of the same item in the same place adds to that marker.

The MelonLoader log shows each one ("Picked up: Stick x3 in LakeRegion"). Nothing is recorded while a save loads, so loading doesn't loot your markers.

The position is kept in server memory only, never in the saved data. Requests run off the game thread, at most one at a time, with a 3 s timeout. If the server is unreachable, the mod skips updates and logs a warning at most once a minute.

## Landmarks and map calibration

Each time a scene loads, the mod writes the scene's doors, cave mouths and region exits to `<TLD>/UserData/TldBuddy/landmarks/<scene>.json`, with their world position and the scene they lead to.

To calibrate a region map:

1. Run `node scripts/calibrate/server.ts` and open http://127.0.0.1:5174. `TLD_DIR` overrides the game path.
2. Pick the scene and artwork, then place 4–6 well-spread landmarks on the map.
3. Check that the blue rings (predictions for unplaced landmarks) land on the right buildings, then click Save.

Saving writes the transform (world x/z → app map x/y) into `public/data/map-calibration.json`, keyed by scene.

## Spike output

Once per second the mod logs the following to the MelonLoader console (and `MelonLoader/Latest.log`):

```
scene=LakeRegion unity=LakeRegion pos=(123.4, 45.6, -78.9) heading=270 containers=142
```
