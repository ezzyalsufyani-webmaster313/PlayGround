using System;

namespace EzzyMoney.Modding
{
    /// <summary>Contents of a mod's mod.json. See docs/MOD_FORMAT.md.</summary>
    [Serializable]
    public class ModManifest
    {
        public string id;
        public string name;
        public string version;
        public string author;
        public string gameVersion;
        public string description;
        public string[] permissions = Array.Empty<string>();
        public string entry;

        public bool HasPermission(string permission) => Array.IndexOf(permissions, permission) >= 0;
    }

    public static class ModPermissions
    {
        public const string Spawn = "spawn";
        public const string Hud = "hud";
        public const string Input = "input";
        public const string World = "world";
        public const string Player = "player";
        public const string Missions = "missions";

        public static readonly string[] All = { Spawn, Hud, Input, World, Player, Missions };
    }
}
