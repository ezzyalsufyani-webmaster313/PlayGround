using System;
using System.Collections.Generic;
using UnityEngine;

namespace EzzyMoney.Modding
{
    [Serializable]
    public class VehicleDef
    {
        public string id;
        public string name;
        public string @class;
        public float massKg;
        public float maxSpeedKmh;
        public string model;
        [NonSerialized] public string source; // "base" or a mod id
    }

    [Serializable]
    public class WeaponDef
    {
        public string id;
        public string name;
        public float damage;
        public float fireRate;
        public int magazine;
        public string model;
        [NonSerialized] public string source;
    }

    [Serializable] class VehicleFile { public VehicleDef[] vehicles; }
    [Serializable] class WeaponFile { public WeaponDef[] weapons; }

    /// <summary>
    /// Every vehicle and weapon the mod menu can spawn: the base game's plus any mod's.
    /// Base content and mods register the same way, so mods show up in the menu automatically.
    /// </summary>
    public static class ContentRegistry
    {
        public static readonly List<VehicleDef> Vehicles = new List<VehicleDef>();
        public static readonly List<WeaponDef> Weapons = new List<WeaponDef>();

        public static void AddVehiclesJson(string json, string source)
        {
            var file = JsonUtility.FromJson<VehicleFile>(json);
            if (file?.vehicles == null) return;
            foreach (var v in file.vehicles)
            {
                if (string.IsNullOrEmpty(v.id)) continue;
                v.source = source;
                Vehicles.RemoveAll(x => x.id == v.id); // a mod can replace a car with the same id
                Vehicles.Add(v);
            }
        }

        public static void AddWeaponsJson(string json, string source)
        {
            var file = JsonUtility.FromJson<WeaponFile>(json);
            if (file?.weapons == null) return;
            foreach (var w in file.weapons)
            {
                if (string.IsNullOrEmpty(w.id)) continue;
                w.source = source;
                Weapons.RemoveAll(x => x.id == w.id);
                Weapons.Add(w);
            }
        }

        public static void RemoveSource(string source)
        {
            Vehicles.RemoveAll(v => v.source == source);
            Weapons.RemoveAll(w => w.source == source);
        }
    }
}
