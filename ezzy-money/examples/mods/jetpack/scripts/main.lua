-- Jetpack: adds a mod menu button that spawns a jetpack above the player.
on_key("Spawn jetpack", function()
  local p = player.position()
  vehicle.spawn("jetpack", p.x, p.y, p.z + 2)
  hud.notify("Jetpack ready")
end)

log("Jetpack mod loaded")
