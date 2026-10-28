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
