using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace EzzyMoney.Modding
{
    /// <summary>
    /// "Add from browser": gets a 6-digit code from the upload server, waits for the player to upload a mod
    /// on the web page, downloads it and hands it to ModLoader (which validates it again).
    /// </summary>
    public class PairingClient : MonoBehaviour
    {
        public string serverUrl = "http://localhost:8787";
        public float pollSeconds = 3f;

        public string Code { get; private set; }
        public string Status { get; private set; } = "";
        public bool Active { get; private set; }

        public event Action<ModManifest> Installed;

        string token;

        [Serializable] class PairResponse { public string code; public string token; public int expiresInSeconds; }
        [Serializable] class PendingItem { public string id; public ModManifest manifest; }
        [Serializable] class PendingList { public PendingItem[] items; }

        public void Begin()
        {
            if (Active) return;
            StartCoroutine(Run());
        }

        public void Stop()
        {
            StopAllCoroutines();
            Active = false;
            Code = null;
            Status = "";
        }

        IEnumerator Run()
        {
            Active = true;
            Status = "Getting a code…";
            using (var req = UnityWebRequest.PostWwwForm(serverUrl + "/api/pair", ""))
            {
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) { Fail("Couldn't reach the mod server."); yield break; }
                var pair = JsonUtility.FromJson<PairResponse>(req.downloadHandler.text);
                Code = pair.code;
                token = pair.token;
            }

            Status = "Open the upload page in any browser and enter this code.";
            var expires = Time.realtimeSinceStartup + 600f;
            while (Time.realtimeSinceStartup < expires)
            {
                yield return new WaitForSecondsRealtime(pollSeconds);

                PendingItem[] pending;
                using (var req = UnityWebRequest.Get(serverUrl + "/api/pending"))
                {
                    req.SetRequestHeader("x-pair-token", token);
                    yield return req.SendWebRequest();
                    if (req.result != UnityWebRequest.Result.Success) continue;
                    // JsonUtility can't read a bare array, so wrap it.
                    pending = JsonUtility.FromJson<PendingList>("{\"items\":" + req.downloadHandler.text + "}").items;
                }

                foreach (var item in pending)
                    yield return Download(item);
            }
            Stop();
        }

        IEnumerator Download(PendingItem item)
        {
            Status = $"Downloading {item.manifest?.name}…";
            var path = Path.Combine(Application.temporaryCachePath, item.id + ".zip");
            using (var req = UnityWebRequest.Get(serverUrl + "/api/download/" + item.id))
            {
                req.SetRequestHeader("x-pair-token", token);
                req.downloadHandler = new DownloadHandlerFile(path) { removeFileOnAbort = true };
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) { Status = "Download failed."; yield break; }
            }

            var result = ModLoader.Instance.Install(path);
            File.Delete(path);
            if (result.Ok)
            {
                Status = $"Installed {result.Manifest.name} {result.Manifest.version}.";
                Installed?.Invoke(result.Manifest);
            }
            else
            {
                Status = "Mod rejected: " + string.Join("; ", result.Errors);
            }
        }

        void Fail(string message)
        {
            Status = message;
            Active = false;
        }
    }
}
