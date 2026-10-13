using UnityEngine;

namespace EzzyMoney.Modding
{
    /// <summary>
    /// What Lua mods are allowed to do to the game. The real game systems implement this;
    /// mods never touch Unity objects directly.
    /// </summary>
    public interface IGameApi
    {
        Vector3 PlayerPosition { get; }
        void SetPlayerHealth(float health);
        void GiveMoney(int amount);
        void SpawnVehicle(string vehicleId, Vector3 position);
        void GiveWeapon(string weaponId, int ammo);
        void SetTimeOfDay(float hour);
        void SetWeather(string weather);
        void Notify(string text);
    }

    /// <summary>Stand-in used until the real player, vehicle and world systems exist.</summary>
    public class DebugGameApi : IGameApi
    {
        public Vector3 PlayerPosition => Vector3.zero;
        public void SetPlayerHealth(float health) => Debug.Log($"[mods] player health = {health}");
        public void GiveMoney(int amount) => Debug.Log($"[mods] give money {amount}");
        public void SpawnVehicle(string vehicleId, Vector3 position) => Debug.Log($"[mods] spawn vehicle {vehicleId} at {position}");
        public void GiveWeapon(string weaponId, int ammo) => Debug.Log($"[mods] give weapon {weaponId} x{ammo}");
        public void SetTimeOfDay(float hour) => Debug.Log($"[mods] time = {hour}");
        public void SetWeather(string weather) => Debug.Log($"[mods] weather = {weather}");
        public void Notify(string text) => Debug.Log($"[mods] notify: {text}");
    }
}
