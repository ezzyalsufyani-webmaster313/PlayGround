# Ezzy Money

A realistic open-world mobile game built in Unity, with modding built in from day one:
an in-game mod menu, Lua scripting (CLEO-style mods) and installing mods from a browser.

## Layout

| Folder | What's in it |
| --- | --- |
| `unity/Assets/Scripts/Modding` | Mod manifest, validator, loader and the sandboxed Lua runtime |
| `unity/Assets/Scripts/UI` | The in-game mod menu |
| `server` | Browser upload page and pairing API (Node, no dependencies) |
| `examples/mods` | Sample mods |
| `docs` | Mod format reference |

## Unity setup

1. Create a Unity 6 project with the **Universal 3D (URP)** template and copy `unity/Assets` into it.
2. Install [MoonSharp](https://www.moonsharp.org/) (Lua runtime) into `Assets/Plugins`.
3. Install `com.unity.addressables` from the Package Manager.
4. Add `ModLoader`, `PairingClient` and `ModMenu` to a bootstrap scene, and drag `Assets/Data/base_vehicles.json` and
   `base_weapons.json` onto the loader so the menu starts with every base car and weapon.

The Unity scripts have not been compiled in the editor yet; expect small fixes on first import.

## Upload server

```sh
cd server
npm test        # validation tests
npm start       # http://localhost:8787
```

The game asks the server for a 6-digit code, the player types it on the upload page and drops a mod `.zip`.
The server validates the package, and the game downloads it and validates it again before installing.

See [docs/MOD_FORMAT.md](docs/MOD_FORMAT.md) for how to make a mod.
