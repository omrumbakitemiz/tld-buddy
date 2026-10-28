using Il2Cpp;
using Il2CppInterop.Runtime;
using MelonLoader;
using UnityEngine;
using UnitySceneManager = UnityEngine.SceneManagement.SceneManager;

[assembly: MelonInfo(typeof(TldBuddy.Mod.TldBuddyMod), "TLD Buddy", "0.1.0", "omrumbakitemiz")]
[assembly: MelonGame("Hinterland", "TheLongDark")]

namespace TldBuddy.Mod
{
    /// <summary>
    /// Spike: logs scene, player position/heading and container count about once per second.
    /// </summary>
    public sealed class TldBuddyMod : MelonMod
    {
        const float LogInterval = 1f;
        const float ContainerScanInterval = 5f;
        const float SceneSettleDelay = 2f;

        float nextLog;
        float nextContainerScan;
        int containerCount = -1;

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

            Vector3 pos = player.position;
            float heading = player.eulerAngles.y;
            string unityScene = UnitySceneManager.GetActiveScene().name;

            LoggerInstance.Msg(
                $"scene={gameScene} unity={unityScene} " +
                $"pos=({pos.x:F1}, {pos.y:F1}, {pos.z:F1}) heading={heading:F0} containers={containerCount}");
        }
    }
}
