# Ezzy Money mod format

A mod is a single `.zip` file.

```
my-mod.zip
├── mod.json            required, at the root
├── scripts/*.lua       optional, sandboxed Lua scripts
├── data/*.json         optional, vehicle / weapon stats
├── assets/*.bundle     optional, models and textures built with the Mod Kit
└── preview.png         optional, thumbnail shown in the mod menu
```

## mod.json

```json
{
  "id": "ezzy.jetpack",
  "name": "Jetpack",
  "version": "1.0.0",
  "author": "Ezzy",
  "gameVersion": "0.1",
  "description": "Adds a spawnable jetpack.",
  "permissions": ["spawn", "hud", "input"],
  "entry": "scripts/main.lua"
}
```

| Field | Rule |
| --- | --- |
| `id` | 3–64 chars, lowercase letters, digits, `.`, `_`, `-` |
| `name` | 1–64 chars |
| `version` | semver, e.g. `1.2.0` |
| `author` | 1–64 chars |
| `gameVersion` | game version the mod was built for, e.g. `0.1` |
| `permissions` | any of `spawn`, `hud`, `input`, `world`, `player`, `missions` |
| `entry` | path of the first script to run, must be under `scripts/` |

## Allowed files

`.json`, `.lua`, `.bundle`, `.png`, `.jpg`, `.ogg`, `.wav`, `.txt`, `.md`.
Anything else (`.dll`, `.so`, `.apk`, `.exe`, …) gets the whole mod rejected.

Limits: 50 MB zipped, 200 MB unzipped, 500 files, no encrypted entries, no `..` or absolute paths.

## Lua API

Scripts only see the game API below plus safe Lua basics (`string`, `table`, `math`).
There is no `io`, `os`, `require`, `load`, `dofile` or network access. Each callback gets a fixed instruction budget,
and a script that runs past it is stopped.

| Call | Needs permission |
| --- | --- |
| `log(msg)` | none |
| `on_key(name, fn)`: adds a button to the mod menu | `input` |
| `on_tick(fn)`: runs every frame | none |
| `player.position()` → `{x, y, z}` | `player` |
| `player.set_health(n)`, `player.give_money(n)` | `player` |
| `vehicle.spawn(id, x, y, z)` | `spawn` |
| `weapon.give(id, ammo)` | `spawn` |
| `world.set_time(hour)`, `world.set_weather(name)` | `world` |
| `hud.notify(text)` | `hud` |
