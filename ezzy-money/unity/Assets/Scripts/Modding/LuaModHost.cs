using System;
using System.Collections.Generic;
using System.IO;
using MoonSharp.Interpreter;
using UnityEngine;

namespace EzzyMoney.Modding
{
    /// <summary>
    /// Runs one mod's Lua scripts in a sandbox (MoonSharp).
    /// No io, os.execute, load, require or dofile; only the game API below and safe Lua basics.
    /// Every call into Lua gets an instruction budget; a mod that blows it is switched off.
    /// </summary>
    public class LuaModHost
    {
        public const long InstructionBudget = 200_000;

        public readonly ModManifest Manifest;
        public readonly string Folder;
        public readonly List<KeyValuePair<string, Closure>> MenuButtons = new List<KeyValuePair<string, Closure>>();
        public bool Faulted { get; private set; }
        public string LastError { get; private set; }

        readonly List<Closure> tickHandlers = new List<Closure>();
        readonly IGameApi game;
        readonly Script script;

        public LuaModHost(ModManifest manifest, string folder, IGameApi game)
        {
            Manifest = manifest;
            Folder = folder;
            this.game = game;

            // Soft sandbox = basic, string, table, math, bit32, coroutine, error handling, json, os.time/clock.
            // It leaves out io, os.execute/remove, load/loadfile/dofile/require and debug.
            script = new Script(CoreModules.Preset_SoftSandbox);
            script.Options.DebugPrint = s => Debug.Log($"[{manifest.id}] {s}");
            BindApi();
        }

        /// <summary>Runs the mod's entry script.</summary>
        public void Start()
        {
            if (string.IsNullOrEmpty(Manifest.entry)) return;
            try
            {
                var chunk = script.LoadString(ReadScript(Manifest.entry), null, Manifest.entry);
                Run(chunk);
            }
            catch (InterpreterException e)
            {
                Fault(e.DecoratedMessage ?? e.Message);
            }
        }

        public void Tick(float deltaTime)
        {
            foreach (var fn in tickHandlers.ToArray())
            {
                if (Faulted) return;
                Run(DynValue.NewClosure(fn), DynValue.NewNumber(deltaTime));
            }
        }

        public void Press(Closure button) => Run(DynValue.NewClosure(button));

        void Run(DynValue function, params DynValue[] args)
        {
            if (Faulted) return;
            try
            {
                var co = script.CreateCoroutine(function).Coroutine;
                co.AutoYieldCounter = InstructionBudget;
                co.Resume(args);
                if (co.State != CoroutineState.Dead)
                    Fault($"took too long (over {InstructionBudget} instructions) and was stopped");
            }
            catch (InterpreterException e)
            {
                Fault(e.DecoratedMessage ?? e.Message);
            }
        }

        void Fault(string message)
        {
            Faulted = true;
            LastError = message;
            Debug.LogWarning($"[mods] {Manifest.name} was switched off: {message}");
        }

        string ReadScript(string relativePath)
        {
            if (!relativePath.StartsWith("scripts/") || !relativePath.EndsWith(".lua") || !ModValidator.IsSafePath(relativePath))
                throw new ScriptRuntimeException($"can't load {relativePath}: scripts must be .lua files under scripts/");
            var full = Path.GetFullPath(Path.Combine(Folder, relativePath));
            if (!full.StartsWith(Path.GetFullPath(Folder) + Path.DirectorySeparatorChar))
                throw new ScriptRuntimeException($"can't load {relativePath}");
            if (!File.Exists(full)) throw new ScriptRuntimeException($"{relativePath} not found");
            return File.ReadAllText(full);
        }

        void Require(string permission)
        {
            if (!Manifest.HasPermission(permission))
                throw new ScriptRuntimeException($"this mod needs the \"{permission}\" permission in mod.json");
        }

        void BindApi()
        {
            var g = script.Globals;

            g["log"] = (Action<string>)(msg => Debug.Log($"[{Manifest.id}] {msg}"));

            g["on_tick"] = (Action<Closure>)(fn => tickHandlers.Add(fn));

            g["on_key"] = (Action<string, Closure>)((label, fn) =>
            {
                Require(ModPermissions.Input);
                MenuButtons.Add(new KeyValuePair<string, Closure>(label, fn));
            });

            var player = new Table(script);
            player["position"] = (Func<Table>)(() =>
            {
                Require(ModPermissions.Player);
                var p = game.PlayerPosition;
                var t = new Table(script);
                t["x"] = p.x; t["y"] = p.y; t["z"] = p.z;
                return t;
            });
            player["set_health"] = (Action<double>)(h => { Require(ModPermissions.Player); game.SetPlayerHealth((float)h); });
            player["give_money"] = (Action<int>)(n => { Require(ModPermissions.Player); game.GiveMoney(n); });
            g["player"] = player;

            var vehicle = new Table(script);
            vehicle["spawn"] = (Action<string, double, double, double>)((id, x, y, z) =>
            {
                Require(ModPermissions.Spawn);
                game.SpawnVehicle(id, new Vector3((float)x, (float)y, (float)z));
            });
            g["vehicle"] = vehicle;

            var weapon = new Table(script);
            weapon["give"] = (Action<string, int>)((id, ammo) => { Require(ModPermissions.Spawn); game.GiveWeapon(id, ammo); });
            g["weapon"] = weapon;

            var world = new Table(script);
            world["set_time"] = (Action<double>)(h => { Require(ModPermissions.World); game.SetTimeOfDay((float)h); });
            world["set_weather"] = (Action<string>)(w => { Require(ModPermissions.World); game.SetWeather(w); });
            g["world"] = world;

            var hud = new Table(script);
            hud["notify"] = (Action<string>)(text => { Require(ModPermissions.Hud); game.Notify(text); });
            g["hud"] = hud;
        }
    }
}
