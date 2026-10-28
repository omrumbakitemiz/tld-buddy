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

## Spike output

Once per second the mod logs the following to the MelonLoader console (and `MelonLoader/Latest.log`):

```
scene=LakeRegion unity=LakeRegion pos=(123.4, 45.6, -78.9) heading=270 containers=142
```
