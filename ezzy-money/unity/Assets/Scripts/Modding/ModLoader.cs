using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using UnityEngine;

namespace EzzyMoney.Modding
{
    /// <summary>
    /// Installs, enables and runs mods. Mods live in persistentDataPath/mods/&lt;mod id&gt;/.
    /// Nothing is extracted or run until ModValidator has passed it.
    /// </summary>
    public class ModLoader : MonoBehaviour
    {
        public static ModLoader Instance { get; private set; }

        [Tooltip("Base game content, registered before mods so mods can replace it.")]
        public TextAsset baseVehicles;
        public TextAsset baseWeapons;

        [Tooltip("Boot with every mod switched off.")]
        public bool safeMode;

        public readonly List<LuaModHost> Running = new List<LuaModHost>();
        public IGameApi Game { get; set; } = new DebugGameApi();

        string ModsRoot => Path.Combine(Application.persistentDataPath, "mods");
        string DisabledFile => Path.Combine(ModsRoot, "disabled.txt");

        void Awake()
        {
            Instance = this;
            Directory.CreateDirectory(ModsRoot);
            if (baseVehicles) ContentRegistry.AddVehiclesJson(baseVehicles.text, "base");
            if (baseWeapons) ContentRegistry.AddWeaponsJson(baseWeapons.text, "base");
            if (!safeMode) LoadAll();
        }

        void Update()
        {
            foreach (var host in Running) host.Tick(Time.deltaTime);
        }

        /// <summary>Validates a downloaded .zip and installs it. Returns the errors if it was rejected.</summary>
        public ModValidator.Result Install(string zipPath)
        {
            var result = ModValidator.Validate(zipPath);
            if (!result.Ok) return result;

            var id = result.Manifest.id;
            var target = Path.Combine(ModsRoot, id);
            var staging = Path.Combine(Application.temporaryCachePath, "mod-" + Guid.NewGuid().ToString("N"));
            try
            {
                ExtractSafely(zipPath, staging);
                Unload(id);
                if (Directory.Exists(target)) Directory.Delete(target, true);
                Directory.Move(staging, target);
            }
            catch (Exception e)
            {
                if (Directory.Exists(staging)) Directory.Delete(staging, true);
                result.Errors.Add("install failed: " + e.Message);
                return result;
            }

            if (!IsDisabled(id)) Load(target);
            return result;
        }

        public IEnumerable<ModManifest> Installed()
        {
            foreach (var dir in Directory.GetDirectories(ModsRoot))
            {
                var m = ReadManifest(dir);
                if (m != null) yield return m;
            }
        }

        public bool IsDisabled(string id) => ReadDisabled().Contains(id);

        public void SetEnabled(string id, bool enabled)
        {
            var disabled = ReadDisabled();
            if (enabled) disabled.Remove(id); else disabled.Add(id);
            File.WriteAllLines(DisabledFile, disabled);

            Unload(id);
            if (enabled && !safeMode) Load(Path.Combine(ModsRoot, id));
        }

        public void Remove(string id)
        {
            Unload(id);
            var dir = Path.Combine(ModsRoot, id);
            if (ModValidator.IsSafePath(id) && Directory.Exists(dir)) Directory.Delete(dir, true);
        }

        void LoadAll()
        {
            var disabled = ReadDisabled();
            foreach (var dir in Directory.GetDirectories(ModsRoot))
            {
                if (!disabled.Contains(Path.GetFileName(dir))) Load(dir);
            }
        }

        void Load(string dir)
        {
            var manifest = ReadManifest(dir);
            if (manifest == null) return;

            var vehicles = Path.Combine(dir, "data", "vehicles.json");
            var weapons = Path.Combine(dir, "data", "weapons.json");
            try
            {
                if (File.Exists(vehicles)) ContentRegistry.AddVehiclesJson(File.ReadAllText(vehicles), manifest.id);
                if (File.Exists(weapons)) ContentRegistry.AddWeaponsJson(File.ReadAllText(weapons), manifest.id);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[mods] {manifest.name}: bad data file: {e.Message}");
            }

            var host = new LuaModHost(manifest, dir, Game);
            Running.Add(host);
            host.Start();
        }

        void Unload(string id)
        {
            Running.RemoveAll(h => h.Manifest.id == id);
            ContentRegistry.RemoveSource(id);
        }

        static ModManifest ReadManifest(string dir)
        {
            var path = Path.Combine(dir, "mod.json");
            if (!File.Exists(path)) return null;
            try { return JsonUtility.FromJson<ModManifest>(File.ReadAllText(path)); }
            catch { return null; }
        }

        HashSet<string> ReadDisabled() =>
            File.Exists(DisabledFile) ? new HashSet<string>(File.ReadAllLines(DisabledFile).Where(l => l.Length > 0)) : new HashSet<string>();

        /// <summary>Extracts entry by entry and refuses anything that would land outside the folder.</summary>
        static void ExtractSafely(string zipPath, string destination)
        {
            var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
            Directory.CreateDirectory(root);
            using (var zip = ZipFile.OpenRead(zipPath))
            {
                foreach (var entry in zip.Entries)
                {
                    var full = Path.GetFullPath(Path.Combine(root, entry.FullName));
                    if (!full.StartsWith(root)) throw new IOException("unsafe path: " + entry.FullName);
                    if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(full); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(full));
                    entry.ExtractToFile(full, overwrite: false);
                }
            }
        }
    }
}
