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
    /// turns the mark key into a marker for the item under the crosshair, reports pickups and drops
    /// (they loot markers and record stashes), logs every few seconds,
    /// and exports each scene's transitions (doors, region exits) as calibration landmarks.
    /// </summary>
    public sealed class TldBuddyMod : MelonMod
    {
        const float TickInterval = 1f;
        const int LogEveryTicks = 10;
        const float ContainerScanInterval = 5f;
        const float SceneSettleDelay = 2f;
        /// <summary>Scenes kept in the trail, so nested interiors still resolve to their region.</summary>
        const int MaxTrail = 4;
        /// <summary>How far the crosshair looks for an item to mark, in metres.</summary>
        const float AimRange = 5f;
        const string DefaultMarkKey = "F4";
        /// <summary>Server limit per event (MAX_EVENT_ITEMS).</summary>
        const int MaxEventItems = 50;

        MelonPreferences_Entry<string> serverUrl;
        MelonPreferences_Entry<string> token;
        MelonPreferences_Entry<bool> runInBackground;
        MelonPreferences_Entry<string> markKeyName;
        LiveBridge bridge;
        Hotkey markKey;

        float nextTick;
        int ticks;
        float nextContainerScan;
        int containerCount = -1;
        string exportedScene;

        /// <summary>Last sample per scene, current scene first. Sent as LiveState.scenes.</summary>
        readonly List<SceneSample> trail = new List<SceneSample>();
        // Omit nulls: the server treats a missing optional field differently from a null one
        static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            IncludeFields = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        public override void OnInitializeMelon()
        {
            // Stored in UserData/MelonPreferences.cfg under [TldBuddy]
            var prefs = MelonPreferences.CreateCategory("TldBuddy", "TLD Buddy");
            serverUrl = prefs.CreateEntry("ServerUrl", "http://192.168.1.133:4000",
                description: "TLD Buddy server, reachable from this PC (LAN address, not the Cloudflare URL)");
            token = prefs.CreateEntry("Token", "",
                description: "Same value as MOD_TOKEN in the server's .env. Empty = live bridge off");
            runInBackground = prefs.CreateEntry("RunInBackground", true,
                description: "Keep the game running while another window (TLD Buddy) has focus, so the live position keeps updating");
            markKeyName = prefs.CreateEntry("MarkKey", DefaultMarkKey,
                description: "Key that marks the item under the crosshair (or the spot) on the TLD Buddy map: F1-F12, a letter or a digit");
            prefs.SaveToFile(false);
            ApplyRunInBackground();
            bridge = new LiveBridge(LoggerInstance);
            ItemEvents.Log = LoggerInstance;
            markKey = Hotkey.Parse(markKeyName.Value);
            if (markKey == null)
            {
                LoggerInstance.Warning($"MarkKey \"{markKeyName.Value}\" is not F1-F12, a letter or a digit; using {DefaultMarkKey}");
                markKey = Hotkey.Parse(DefaultMarkKey);
            }

            LoggerInstance.Msg(string.IsNullOrWhiteSpace(token.Value)
                ? "TLD Buddy loaded. Live bridge off: set Token under [TldBuddy] in UserData/MelonPreferences.cfg"
                : $"TLD Buddy loaded. Live bridge to {serverUrl.Value}, mark key {markKey.Name}");
        }

        public override void OnSceneWasInitialized(int buildIndex, string sceneName)
        {
            LoggerInstance.Msg($"Scene initialized: {sceneName} (build index {buildIndex})");
            // Pickups just before the door belong to the scene left; the trail still has it first
            FlushItemEvents();
            ItemEvents.Ready = false;
            // Right after a load the player still has the old scene's position and the old
            // scene's containers are not destroyed yet; wait a moment before reading either.
            nextTick = Time.unscaledTime + SceneSettleDelay;
            nextContainerScan = 0f;
            exportedScene = null;
            // The game may reset it while loading; set it again for every scene
            ApplyRunInBackground();
        }

        void ApplyRunInBackground()
        {
            if (runInBackground.Value) Application.runInBackground = true;
        }

        public override void OnUpdate()
        {
            // Every frame: key presses and notices from background requests
            while (bridge.TryTakeNotice(out string notice)) HUDMessage.AddMessage(notice, false, false);
            if (markKey.Pressed(Application.isFocused)) MarkHere();

            float now = Time.unscaledTime;
            if (now < nextTick) return;
            nextTick = now + TickInterval;

            // The main menu has a player transform too; only report real gameplay scenes.
            string gameScene = InGameScene();
            if (gameScene == null)
            {
                // A save loaded next may be anywhere: don't place it relative to the last one
                trail.Clear();
                ItemEvents.Ready = false;
                ItemEvents.Discard();
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
            UpdateTrail(Sample(gameScene, player));
            // Ticks only run once the scene has settled (see OnSceneWasInitialized)
            ItemEvents.Ready = true;
            FlushItemEvents();

            if (BridgeOn)
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

        bool BridgeOn => !string.IsNullOrWhiteSpace(token.Value);

        /// <summary>The game's scene name while playing; null in the main menu or while loading.</summary>
        static string InGameScene()
        {
            string scene = GameManager.m_ActiveScene;
            return string.IsNullOrEmpty(scene) || scene == "MainMenu" ? null : scene;
        }

        static SceneSample Sample(string scene, Transform player)
        {
            Vector3 p = player.position;
            return new SceneSample(scene, Round(p.x), Round(p.y), Round(p.z), Round(player.eulerAngles.y));
        }

        /// <summary>
        /// Mark key: sends the item under the crosshair (or just the spot) with the scene trail,
        /// using the position right now rather than the last once-a-second sample.
        /// </summary>
        void MarkHere()
        {
            string scene = InGameScene();
            Transform player = scene != null ? GameManager.GetPlayerTransform() : null;
            if (player == null) return;
            if (!BridgeOn)
            {
                HUDMessage.AddMessage("TLD Buddy: live bridge is off (no Token in MelonPreferences.cfg)", false, false);
                return;
            }

            UpdateTrail(Sample(scene, player));
            MarkItem item = AimedItem();
            var mark = new MarkEvent(System.Guid.NewGuid().ToString(), new List<SceneSample>(trail), item);
            string label = item != null ? (item.quantity > 1 ? $"{item.name} x{item.quantity}" : item.name) : "spot";
            bridge.SendEvent(serverUrl.Value, token.Value.Trim(), JsonSerializer.Serialize(mark, JsonOptions),
                $"TLD Buddy: marked {label}", "TLD Buddy: could not send the mark (see MelonLoader log)");
            // Prefab name and object id too: they decide the item match and the duplicate check
            LoggerInstance.Msg($"Mark: {label} in {scene} (prefab {item?.gearName ?? "-"}, id {item?.objectId ?? "-"})");
            SaveMarkPoint(trail[0], label);
        }

        /// <summary>
        /// Appends the mark's exact position to UserData/TldBuddy/marks/&lt;scene&gt;.json. The
        /// calibration tool lists these next to the doors, so regions with few doors can be
        /// calibrated from spots you marked yourself (a bridge, a river bend).
        /// </summary>
        void SaveMarkPoint(SceneSample at, string label)
        {
            try
            {
                string dir = Path.Combine(MelonEnvironment.UserDataDirectory, "TldBuddy", "marks");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, at.scene + ".json");
                var points = File.Exists(path)
                    ? JsonSerializer.Deserialize<List<MarkPoint>>(File.ReadAllText(path), JsonOptions) ?? new List<MarkPoint>()
                    : new List<MarkPoint>();
                points.Add(new MarkPoint(label, System.DateTime.Now.ToString("yyyy-MM-dd HH:mm"), at.x, at.y, at.z));
                File.WriteAllText(path, JsonSerializer.Serialize(points, new JsonSerializerOptions(JsonOptions) { WriteIndented = true }));
            }
            catch (System.Exception e)
            {
                LoggerInstance.Warning($"Could not save the mark position for calibration: {e.Message}");
            }
        }

        /// <summary>
        /// Sends what was picked up or put down since the last tick, one event per kind and
        /// container, with repeats of an item (sticks picked up one by one) added together.
        /// </summary>
        void FlushItemEvents()
        {
            if (!ItemEvents.HasPending) return;
            var entries = ItemEvents.TakeAll();
            if (!BridgeOn || trail.Count == 0) return;

            var groups = new Dictionary<string, ItemsEvent>();
            foreach (var e in entries)
            {
                string key = e.type + "|" + e.container;
                if (!groups.TryGetValue(key, out var ev))
                {
                    ev = new ItemsEvent(System.Guid.NewGuid().ToString(), e.type, new List<SceneSample>(trail), e.container);
                    groups[key] = ev;
                }
                // Separate objects stay separate items, so each can loot its own marker
                var same = e.objectId == null ? ev.items.Find(i => i.objectId == null && i.name == e.name && i.gearName == e.gearName) : null;
                if (same != null) same.quantity = System.Math.Min(same.quantity + e.quantity, 9999);
                else if (ev.items.Count < MaxEventItems) ev.items.Add(new MarkItem(e.name, e.gearName, e.quantity, e.objectId));
            }
            foreach (var ev in groups.Values)
            {
                string what = string.Join(", ", ev.items.ConvertAll(i => i.quantity > 1 ? $"{i.name} x{i.quantity}" : i.name));
                LoggerInstance.Msg($"{(ev.type == "pickup" ? "Picked up" : "Put down")}: {what}{(ev.container != null ? $" ({ev.container})" : "")} in {trail[0].scene}");
                bridge.SendEvent(serverUrl.Value, token.Value.Trim(), JsonSerializer.Serialize(ev, JsonOptions),
                    null, $"TLD Buddy: could not send a {ev.type} (see MelonLoader log)");
            }
        }

        /// <summary>The gear item under the crosshair, or null (nothing, or not an item: a door, a container).</summary>
        MarkItem AimedItem()
        {
            try
            {
                PlayerManager pm = GameManager.GetPlayerManagerComponent();
                GameObject target = pm != null ? pm.GetInteractiveObjectUnderCrosshairs(AimRange) : null;
                // The crosshair may hit a child (a mesh or collider) of the item
                GearItem gear = target != null ? target.GetComponent<GearItem>() ?? target.GetComponentInParent<GearItem>() : null;
                if (gear == null) return null;
                string name = gear.DisplayName;
                if (string.IsNullOrWhiteSpace(name)) return null;
                int units = Gear.Units(gear);
                return new MarkItem(name.Trim(), Gear.PrefabName(gear.gameObject.name), Mathf.Clamp(units, 1, 9999), Gear.ObjectId(gear.gameObject));
            }
            catch (System.Exception e)
            {
                // A game update changing these APIs should cost the item name, not the mark
                LoggerInstance.Warning($"Could not read the item under the crosshair: {e.Message}");
                return null;
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

        sealed class MarkPoint
        {
            public string label;
            public string time;
            public double x, y, z;

            // Needed by the JSON reader
            public MarkPoint() { }

            public MarkPoint(string label, string time, double x, double y, double z)
            {
                this.label = label;
                this.time = time;
                this.x = x;
                this.y = y;
                this.z = z;
            }
        }

        sealed class MarkItem
        {
            public string name;
            public string gearName;
            public int quantity;
            public string objectId;

            public MarkItem(string name, string gearName, int quantity, string objectId)
            {
                this.name = name;
                this.gearName = gearName;
                this.quantity = quantity;
                this.objectId = objectId;
            }
        }

        /// <summary>Body of POST /api/live/v1/events (shared/utils/live.ts LiveMarkEvent).</summary>
        sealed class MarkEvent
        {
            public string id;
            public string type = "mark";
            public List<SceneSample> scenes;
            public MarkItem item;

            public MarkEvent(string id, List<SceneSample> scenes, MarkItem item)
            {
                this.id = id;
                this.scenes = scenes;
                this.item = item;
            }
        }

        /// <summary>Body of POST /api/live/v1/events (shared/utils/live.ts LiveItemsEvent).</summary>
        sealed class ItemsEvent
        {
            public string id;
            public string type;
            public List<SceneSample> scenes;
            public List<MarkItem> items = new List<MarkItem>();
            public string container;

            public ItemsEvent(string id, string type, List<SceneSample> scenes, string container)
            {
                this.id = id;
                this.type = type;
                this.scenes = scenes;
                this.container = container;
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
