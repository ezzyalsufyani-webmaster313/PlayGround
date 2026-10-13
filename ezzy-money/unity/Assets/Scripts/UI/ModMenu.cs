using System.Linq;
using EzzyMoney.Modding;
using UnityEngine;

namespace EzzyMoney.UI
{
    /// <summary>
    /// In-game mod menu. First version uses IMGUI so it works on any device right away;
    /// it will move to UI Toolkit once the art direction for menus is set.
    /// </summary>
    public class ModMenu : MonoBehaviour
    {
        public ModLoader loader;
        public PairingClient pairing;
        public KeyCode toggleKey = KeyCode.F1;

        enum Tab { Vehicles, Weapons, World, Player, ModButtons, Mods, AddFromBrowser }
        static readonly string[] TabNames = { "Vehicles", "Weapons", "World", "Player", "Mod buttons", "Mods", "Add from browser" };

        bool open;
        Tab tab;
        Vector2 scroll;
        string search = "";

        IGameApi Game => loader.Game;

        void Update()
        {
            if (Input.GetKeyDown(toggleKey)) open = !open;
        }

        void OnGUI()
        {
            var scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1));
            var w = Screen.width / scale;
            var h = Screen.height / scale;

            if (!open)
            {
                if (GUI.Button(new Rect(w - 90, 10, 80, 40), "Mods")) open = true;
                return;
            }

            GUILayout.BeginArea(new Rect(10, 10, Mathf.Min(w - 20, 520), h - 20), GUI.skin.box);
            GUILayout.BeginHorizontal();
            GUILayout.Label("<b>Ezzy Money: Mod Menu</b>", new GUIStyle(GUI.skin.label) { richText = true, fontSize = 18 });
            if (GUILayout.Button("Close", GUILayout.Width(70))) open = false;
            GUILayout.EndHorizontal();

            tab = (Tab)GUILayout.SelectionGrid((int)tab, TabNames, 4);
            if (tab == Tab.Vehicles || tab == Tab.Weapons) search = GUILayout.TextField(search);

            scroll = GUILayout.BeginScrollView(scroll);
            switch (tab)
            {
                case Tab.Vehicles: DrawVehicles(); break;
                case Tab.Weapons: DrawWeapons(); break;
                case Tab.World: DrawWorld(); break;
                case Tab.Player: DrawPlayer(); break;
                case Tab.ModButtons: DrawModButtons(); break;
                case Tab.Mods: DrawMods(); break;
                case Tab.AddFromBrowser: DrawAddFromBrowser(); break;
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        bool Matches(string name) => string.IsNullOrEmpty(search) || name.ToLowerInvariant().Contains(search.ToLowerInvariant());

        void DrawVehicles()
        {
            foreach (var v in ContentRegistry.Vehicles.Where(v => Matches(v.name ?? v.id)))
                if (GUILayout.Button($"{v.name}   <{v.source}>"))
                    Game.SpawnVehicle(v.id, Game.PlayerPosition + Vector3.forward * 4 + Vector3.up);
        }

        void DrawWeapons()
        {
            foreach (var wpn in ContentRegistry.Weapons.Where(x => Matches(x.name ?? x.id)))
                if (GUILayout.Button($"{wpn.name}   <{wpn.source}>"))
                    Game.GiveWeapon(wpn.id, Mathf.Max(wpn.magazine, 1) * 5);
        }

        void DrawWorld()
        {
            GUILayout.Label("Time of day");
            GUILayout.BeginHorizontal();
            foreach (var hour in new[] { 6, 12, 18, 0 })
                if (GUILayout.Button($"{hour:00}:00")) Game.SetTimeOfDay(hour);
            GUILayout.EndHorizontal();
            GUILayout.Label("Weather");
            GUILayout.BeginHorizontal();
            foreach (var weather in new[] { "clear", "cloudy", "rain", "fog", "storm" })
                if (GUILayout.Button(weather)) Game.SetWeather(weather);
            GUILayout.EndHorizontal();
        }

        void DrawPlayer()
        {
            if (GUILayout.Button("Full health")) Game.SetPlayerHealth(100);
            if (GUILayout.Button("+ $10,000")) Game.GiveMoney(10_000);
        }

        void DrawModButtons()
        {
            var any = false;
            foreach (var host in loader.Running.Where(m => !m.Faulted))
            {
                if (host.MenuButtons.Count == 0) continue;
                any = true;
                GUILayout.Label(host.Manifest.name);
                foreach (var button in host.MenuButtons)
                    if (GUILayout.Button(button.Key)) host.Press(button.Value);
            }
            if (!any) GUILayout.Label("No installed mod has added buttons yet.");
        }

        void DrawMods()
        {
            foreach (var m in loader.Installed().ToList())
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                var running = loader.Running.FirstOrDefault(r => r.Manifest.id == m.id);
                var state = running == null ? "off" : running.Faulted ? "stopped: " + running.LastError : "on";
                GUILayout.Label($"{m.name} {m.version}\nby {m.author} · {state}\nneeds: {string.Join(", ", m.permissions)}");
                var enabled = !loader.IsDisabled(m.id);
                if (GUILayout.Button(enabled ? "Turn off" : "Turn on", GUILayout.Width(80))) loader.SetEnabled(m.id, !enabled);
                if (GUILayout.Button("Remove", GUILayout.Width(70))) loader.Remove(m.id);
                GUILayout.EndHorizontal();
            }
            if (loader.safeMode) GUILayout.Label("Safe Mode is on: mods are installed but not running.");
        }

        void DrawAddFromBrowser()
        {
            if (!pairing.Active)
            {
                GUILayout.Label("Upload a mod .zip from any browser and it installs here.");
                if (GUILayout.Button("Get a code")) pairing.Begin();
            }
            else
            {
                GUILayout.Label($"<size=40><b>{pairing.Code}</b></size>", new GUIStyle(GUI.skin.label) { richText = true, alignment = TextAnchor.MiddleCenter });
                GUILayout.Label($"Upload page: {pairing.serverUrl}");
                if (GUILayout.Button("Cancel")) pairing.Stop();
            }
            GUILayout.Label(pairing.Status);
        }
    }
}
