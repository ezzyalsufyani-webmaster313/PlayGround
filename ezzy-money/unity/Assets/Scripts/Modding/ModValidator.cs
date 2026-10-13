using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace EzzyMoney.Modding
{
    /// <summary>
    /// Checks a mod .zip before anything in it is extracted or run.
    /// Mirrors server/src/validate.js so a mod is checked on both sides.
    /// </summary>
    public static class ModValidator
    {
        public const long MaxZipBytes = 50L * 1024 * 1024;
        public const long MaxUnzippedBytes = 200L * 1024 * 1024;
        public const int MaxFiles = 500;
        const int MaxManifestBytes = 64 * 1024;

        static readonly HashSet<string> AllowedExtensions = new HashSet<string>
            { ".json", ".lua", ".bundle", ".png", ".jpg", ".ogg", ".wav", ".txt", ".md" };
        static readonly Regex IdRegex = new Regex("^[a-z0-9._-]{3,64}$");
        static readonly Regex SemverRegex = new Regex(@"^\d+\.\d+\.\d+$");

        public class Result
        {
            public bool Ok => Errors.Count == 0;
            public readonly List<string> Errors = new List<string>();
            public ModManifest Manifest;
        }

        public static Result Validate(string zipPath)
        {
            var result = new Result();
            try
            {
                if (new FileInfo(zipPath).Length > MaxZipBytes)
                {
                    result.Errors.Add("mod is larger than 50 MB");
                    return result;
                }
                using (var zip = ZipFile.OpenRead(zipPath))
                    ValidateArchive(zip, result);
            }
            catch (InvalidDataException)
            {
                result.Errors.Add("not a zip file");
            }
            catch (Exception e)
            {
                result.Errors.Add("could not read mod: " + e.Message);
            }
            return result;
        }

        static void ValidateArchive(ZipArchive zip, Result result)
        {
            var files = zip.Entries.Where(e => !e.FullName.EndsWith("/")).ToList();
            if (files.Count > MaxFiles)
            {
                result.Errors.Add($"mod has more than {MaxFiles} files");
                return;
            }

            long total = 0;
            foreach (var e in zip.Entries)
            {
                if (!IsSafePath(e.FullName)) result.Errors.Add("unsafe path: " + e.FullName);
                total += e.Length;
            }
            foreach (var e in files)
            {
                var ext = Path.GetExtension(e.FullName).ToLowerInvariant();
                if (!AllowedExtensions.Contains(ext)) result.Errors.Add("file type not allowed: " + e.FullName);
                if (ext == ".lua" && !e.FullName.StartsWith("scripts/")) result.Errors.Add("scripts must be in scripts/: " + e.FullName);
            }
            if (total > MaxUnzippedBytes) result.Errors.Add("mod unpacks to more than 200 MB");
            if (!result.Ok) return;

            var manifestEntry = files.FirstOrDefault(e => e.FullName == "mod.json");
            if (manifestEntry == null)
            {
                result.Errors.Add("mod.json is missing from the root of the zip");
                return;
            }

            ModManifest manifest;
            try
            {
                manifest = JsonUtility.FromJson<ModManifest>(ReadText(manifestEntry, MaxManifestBytes));
            }
            catch (Exception e)
            {
                result.Errors.Add("mod.json could not be read: " + e.Message);
                return;
            }

            ValidateManifest(manifest, new HashSet<string>(files.Select(f => f.FullName)), result.Errors);
            if (result.Ok) result.Manifest = manifest;
        }

        public static void ValidateManifest(ModManifest m, HashSet<string> fileNames, List<string> errors)
        {
            if (m == null) { errors.Add("mod.json must be a JSON object"); return; }
            if (m.id == null || !IdRegex.IsMatch(m.id)) errors.Add("mod.json: \"id\" must be 3-64 lowercase letters, digits, \".\", \"_\" or \"-\"");
            CheckText(m.name, "name", 64, errors);
            CheckText(m.author, "author", 64, errors);
            CheckText(m.gameVersion, "gameVersion", 16, errors);
            if (m.version == null || !SemverRegex.IsMatch(m.version)) errors.Add("mod.json: \"version\" must look like 1.0.0");
            foreach (var p in m.permissions ?? Array.Empty<string>())
                if (Array.IndexOf(ModPermissions.All, p) < 0) errors.Add($"mod.json: unknown permission \"{p}\"");
            if (!string.IsNullOrEmpty(m.entry))
            {
                if (!m.entry.StartsWith("scripts/") || !m.entry.EndsWith(".lua")) errors.Add("mod.json: \"entry\" must be a .lua file under scripts/");
                else if (!fileNames.Contains(m.entry)) errors.Add($"mod.json: entry script {m.entry} is missing");
            }
        }

        public static bool IsSafePath(string name)
        {
            if (name.Contains("\\") || name.Contains("\0")) return false;
            if (name.StartsWith("/") || (name.Length > 1 && name[1] == ':')) return false;
            return !name.Split('/').Contains("..");
        }

        static void CheckText(string value, string key, int max, List<string> errors)
        {
            if (string.IsNullOrEmpty(value) || value.Length > max) errors.Add($"mod.json: \"{key}\" must be text of 1-{max} characters");
        }

        /// <summary>Reads at most maxBytes, whatever size the zip header claims.</summary>
        static string ReadText(ZipArchiveEntry entry, int maxBytes)
        {
            using (var stream = entry.Open())
            using (var ms = new MemoryStream())
            {
                var buffer = new byte[8192];
                int read;
                while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    if (ms.Length + read > maxBytes) throw new InvalidDataException($"{entry.FullName} is too large");
                    ms.Write(buffer, 0, read);
                }
                return System.Text.Encoding.UTF8.GetString(ms.ToArray());
            }
        }
    }
}
