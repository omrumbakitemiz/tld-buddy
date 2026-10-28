using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Il2Cpp;
using Il2CppInterop.Runtime;
using MelonLoader;
using MelonLoader.Utils;
using UnityEngine;
using UnitySceneManager = UnityEngine.SceneManagement.SceneManager;

[assembly: MelonInfo(typeof(TldBuddy.Mod.TldBuddyMod), "TLD Buddy", "0.1.0", "omrumbakitemiz")]
[assembly: MelonGame("Hinterland", "TheLongDark")]

namespace TldBuddy.Mod
{
    /// <summary>
    /// Sends the player's scene and position to the TLD Buddy server about once per second,
    /// logs it every few seconds, and exports each scene's transitions (doors, region exits)
    /// as calibration landmarks.
    /// </summary>
    public sealed class TldBuddyMod : MelonMod
    {
        const float TickInterval = 1f;
        const int LogEveryTicks = 10;
        const float ContainerScanInterval = 5f;
        const float SceneSettleDelay = 2f;
        /// <summary>Scenes kept in the trail, so nested interiors still resolve to their region.</summary>
        const int MaxTrail = 4;

        MelonPreferences_Entry<string> serverUrl;
        MelonPreferences_Entry<string> token;
        LiveBridge bridge;

        float nextTick;
        int ticks;
        float nextContainerScan;
        int containerCount = -1;
        string exportedScene;

        /// <summary>Last sample per scene, current scene first. Sent as LiveState.scenes.</summary>
        readonly List<SceneSample> trail = new List<SceneSample>();
        static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions { IncludeFields = true };

        public override void OnInitializeMelon()
        {
            // Stored in UserData/MelonPreferences.cfg under [TldBuddy]
            var prefs = MelonPreferences.CreateCategory("TldBuddy", "TLD Buddy");
            serverUrl = prefs.CreateEntry("ServerUrl", "http://192.168.1.133:4000",
                description: "TLD Buddy server, reachable from this PC (LAN address, not the Cloudflare URL)");
            token = prefs.CreateEntry("Token", "",
                description: "Same value as MOD_TOKEN in the server's .env. Empty = live bridge off");
            prefs.SaveToFile(false);
            bridge = new LiveBridge(LoggerInstance);

            LoggerInstance.Msg(string.IsNullOrWhiteSpace(token.Value)
                ? "TLD Buddy loaded. Live bridge off: set Token under [TldBuddy] in UserData/MelonPreferences.cfg"
                : $"TLD Buddy loaded. Live bridge to {serverUrl.Value}");
        }

        public override void OnSceneWasInitialized(int buildIndex, string sceneName)
        {
            LoggerInstance.Msg($"Scene initialized: {sceneName} (build index {buildIndex})");
            // Right after a load the player still has the old scene's position and the old
            // scene's containers are not destroyed yet; wait a moment before reading either.
            nextTick = Time.unscaledTime + SceneSettleDelay;
            nextContainerScan = 0f;
            exportedScene = null;
        }

        public override void OnUpdate()
        {
            float now = Time.unscaledTime;
            if (now < nextTick) return;
            nextTick = now + TickInterval;

            // The main menu has a player transform too; only report real gameplay scenes.
            string gameScene = GameManager.m_ActiveScene;
            if (string.IsNullOrEmpty(gameScene) || gameScene == "MainMenu")
            {
                // A save loaded next may be anywhere: don't place it relative to the last one
                trail.Clear();
                return;
            }

            Transform player = GameManager.GetPlayerTransform();
            if (player == null) return;

            if (now >= nextContainerScan)
            {
                nextContainerScan = now + ContainerScanInterval;
                containerCount = Object.FindObjectsOfType(Il2CppType.Of<Container>()).Length;
            }

            if (exportedScene != gameScene)
            {
                exportedScene = gameScene;
                ExportLandmarks(gameScene);
            }

            Vector3 pos = player.position;
            float heading = player.eulerAngles.y;
            UpdateTrail(new SceneSample(gameScene, Round(pos.x), Round(pos.y), Round(pos.z), Round(heading)));

            if (!string.IsNullOrWhiteSpace(token.Value))
            {
                bridge.Send(serverUrl.Value, token.Value.Trim(), JsonSerializer.Serialize(new LiveState(trail), JsonOptions));
            }

            if (ticks++ % LogEveryTicks == 0)
            {
                string unityScene = UnitySceneManager.GetActiveScene().name;
                LoggerInstance.Msg(
                    $"scene={gameScene} unity={unityScene} " +
                    $"pos=({pos.x:F1}, {pos.y:F1}, {pos.z:F1}) heading={heading:F0} containers={containerCount}");
            }
        }

        /// <summary>
        /// Puts the current scene's sample first. Entries for scenes left earlier keep their last
        /// sample, which is where the player walked through the door into the next scene.
        /// </summary>
        void UpdateTrail(SceneSample current)
        {
            trail.RemoveAll(s => s.scene == current.scene);
            trail.Insert(0, current);
            if (trail.Count > MaxTrail) trail.RemoveRange(MaxTrail, trail.Count - MaxTrail);
        }

        /// <summary>
        /// Writes every LoadScene trigger in the scene (building doors, cave mouths, region exits)
        /// to UserData/TldBuddy/landmarks/&lt;scene&gt;.json. Their target scene names identify them,
        /// which makes them usable as named reference points for map calibration.
        /// </summary>
        void ExportLandmarks(string scene)
        {
            var landmarks = new List<Landmark>();
            foreach (var obj in Object.FindObjectsOfType(Il2CppType.Of<LoadScene>()))
            {
                var door = obj.Cast<LoadScene>();
                string target = door.m_SceneToLoad;
                if (string.IsNullOrEmpty(target)) continue;
                Vector3 p = door.transform.position;
                landmarks.Add(new Landmark(target, door.m_ExitPointName, Round(p.x), Round(p.y), Round(p.z)));
            }
            landmarks.Sort((a, b) => string.CompareOrdinal(a.target, b.target));

            string dir = Path.Combine(MelonEnvironment.UserDataDirectory, "TldBuddy", "landmarks");
            Directory.CreateDirectory(dir);
            string path = Path.Combine(dir, scene + ".json");
            var options = new JsonSerializerOptions { WriteIndented = true, IncludeFields = true };
            File.WriteAllText(path, JsonSerializer.Serialize(new LandmarkFile(scene, landmarks), options));
            LoggerInstance.Msg($"Exported {landmarks.Count} landmarks to {path}");
        }

        static double Round(float v) => System.Math.Round(v, 2);

        sealed class Landmark
        {
            public string target;
            public string exitPoint;
            public double x, y, z;

            public Landmark(string target, string exitPoint, double x, double y, double z)
            {
                this.target = target;
                this.exitPoint = exitPoint;
                this.x = x;
                this.y = y;
                this.z = z;
            }
        }

        sealed class SceneSample
        {
            public string scene;
            public double x, y, z, heading;

            public SceneSample(string scene, double x, double y, double z, double heading)
            {
                this.scene = scene;
                this.x = x;
                this.y = y;
                this.z = z;
                this.heading = heading;
            }
        }

        /// <summary>Body of POST /api/live/v1/state (shared/utils/live.ts LiveState).</summary>
        sealed class LiveState
        {
            public List<SceneSample> scenes;

            public LiveState(List<SceneSample> scenes)
            {
                this.scenes = scenes;
            }
        }

        sealed class LandmarkFile
        {
            public string scene;
            public List<Landmark> landmarks;

            public LandmarkFile(string scene, List<Landmark> landmarks)
            {
                this.scene = scene;
                this.landmarks = landmarks;
            }
        }
    }
}
