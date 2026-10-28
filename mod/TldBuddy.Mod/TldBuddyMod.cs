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
    /// Spike: logs scene, player position/heading and container count about once per second,
    /// and exports each scene's transitions (doors, region exits) as calibration landmarks.
    /// </summary>
    public sealed class TldBuddyMod : MelonMod
    {
        const float LogInterval = 1f;
        const float ContainerScanInterval = 5f;
        const float SceneSettleDelay = 2f;

        float nextLog;
        float nextContainerScan;
        int containerCount = -1;
        string exportedScene;

        public override void OnInitializeMelon()
        {
            LoggerInstance.Msg("TLD Buddy spike loaded");
        }

        public override void OnSceneWasInitialized(int buildIndex, string sceneName)
        {
            LoggerInstance.Msg($"Scene initialized: {sceneName} (build index {buildIndex})");
            // Right after a load the player still has the old scene's position and the old
            // scene's containers are not destroyed yet; wait a moment before reading either.
            nextLog = Time.unscaledTime + SceneSettleDelay;
            nextContainerScan = 0f;
            exportedScene = null;
        }

        public override void OnUpdate()
        {
            float now = Time.unscaledTime;
            if (now < nextLog) return;
            nextLog = now + LogInterval;

            // The main menu has a player transform too; only report real gameplay scenes.
            string gameScene = GameManager.m_ActiveScene;
            if (string.IsNullOrEmpty(gameScene) || gameScene == "MainMenu") return;

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
            string unityScene = UnitySceneManager.GetActiveScene().name;

            LoggerInstance.Msg(
                $"scene={gameScene} unity={unityScene} " +
                $"pos=({pos.x:F1}, {pos.y:F1}, {pos.z:F1}) heading={heading:F0} containers={containerCount}");
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
