using System.Collections.Generic;
using System.Text.Json;
using Il2Cpp;
using MelonLoader;
using UnityEngine;

namespace TldBuddy.Mod
{
    /// <summary>
    /// In-game HUD: a compass strip at the top of the screen with the run's markers and stashes in
    /// front of the player (name and distance), and a line listing those close by. Indoors, the
    /// markers noted inside this building. The markers come from GET /api/live/v1/hud.
    /// </summary>
    sealed class Hud
    {
        /// <summary>Compass shows markers up to this far, in metres.</summary>
        const float CompassRange = 250f;
        /// <summary>"Nearby" lists markers this close, in metres.</summary>
        const float NearbyRange = 20f;
        /// <summary>Half of the field the compass strip spans, in degrees either side of straight ahead.</summary>
        const float HalfFov = 75f;
        const int MaxNearby = 4;

        readonly MelonLogger.Instance log;
        HudData data;
        string dataScene;
        GUIStyle label, small;
        float styleScale;

        public bool Visible = true;

        public Hud(MelonLogger.Instance log)
        {
            this.log = log;
        }

        /// <summary>Takes a server answer for `scene`.</summary>
        public void SetData(string json, string scene)
        {
            try
            {
                data = JsonSerializer.Deserialize<HudData>(json, new JsonSerializerOptions { IncludeFields = true });
                dataScene = scene;
            }
            catch (System.Exception e)
            {
                log.Warning($"HUD: could not read the server's answer: {e.Message}");
            }
        }

        /// <summary>Forgets the markers (main menu, another save): they belong to the save left.</summary>
        public void Clear()
        {
            data = null;
            dataScene = null;
        }

        /// <summary>Called from OnGUI.</summary>
        public void Draw(string scene, Transform player)
        {
            if (!Visible || data?.markers == null || player == null || scene != dataScene || Hidden()) return;
            EnsureStyles();

            Vector3 pos = player.position;
            // The camera, not the body: the compass turns with where you look
            Camera camera = GameManager.GetMainCamera();
            Transform view = camera != null ? camera.transform : player;
            float heading = view.eulerAngles.y;
            float s = styleScale;
            float width = Mathf.Min(900f * s, Screen.width * 0.6f);
            float height = 30f * s;
            var strip = new Rect((Screen.width - width) / 2f, 8f * s, width, height);

            var nearby = new List<(HudMarker m, float d)>();
            var ahead = new List<(HudMarker m, float d, float rel)>();
            foreach (var m in data.markers)
            {
                if (m.x == null || m.z == null)
                {
                    // Indoors: markers of this building, no position
                    nearby.Add((m, -1f));
                    continue;
                }
                float dx = (float)m.x.Value - pos.x, dz = (float)m.z.Value - pos.z;
                float d = Mathf.Sqrt(dx * dx + dz * dz);
                if (d <= NearbyRange) nearby.Add((m, d));
                if (d > CompassRange) continue;
                float rel = Mathf.DeltaAngle(heading, Mathf.Atan2(dx, dz) * Mathf.Rad2Deg);
                if (Mathf.Abs(rel) <= HalfFov) ahead.Add((m, d, rel));
            }

            bool indoors = data.markers.Count > 0 && data.markers[0].x == null;
            if (!indoors) DrawCompass(strip, heading, ahead);

            if (nearby.Count > 0)
            {
                nearby.Sort((a, b) => a.d.CompareTo(b.d));
                var parts = new List<string>();
                for (int i = 0; i < nearby.Count && i < MaxNearby; i++)
                {
                    var (m, d) = nearby[i];
                    parts.Add(d < 0 ? Name(m) : $"{Name(m)} {Mathf.RoundToInt(d)} m");
                }
                if (nearby.Count > MaxNearby) parts.Add($"+{nearby.Count - MaxNearby} more");
                string text = (indoors ? "In this building: " : "Nearby: ") + string.Join(" · ", parts);
                float y = indoors ? strip.y : strip.yMax + 4f * s;
                Shadowed(new Rect(0, y, Screen.width, 24f * s), text, small, new Color(0.95f, 0.93f, 0.86f, 0.95f));
            }
        }

        void DrawCompass(Rect strip, float heading, List<(HudMarker m, float d, float rel)> ahead)
        {
            float s = styleScale;
            GUI.color = new Color(0.08f, 0.1f, 0.14f, 0.45f);
            GUI.DrawTexture(strip, Texture2D.whiteTexture);
            GUI.color = Color.white;

            float center = strip.center.x;
            float half = strip.width / 2f;
            // Cardinal points
            string[] names = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };
            for (int i = 0; i < 8; i++)
            {
                float rel = Mathf.DeltaAngle(heading, i * 45f);
                if (Mathf.Abs(rel) > HalfFov) continue;
                float x = center + rel / HalfFov * half;
                var color = i % 2 == 0 ? new Color(1f, 1f, 1f, 0.9f) : new Color(1f, 1f, 1f, 0.5f);
                Shadowed(new Rect(x - 20f * s, strip.y, 40f * s, strip.height), names[i], label, color);
            }

            // Nearest first, so a nearer marker wins where labels would overlap
            ahead.Sort((a, b) => a.d.CompareTo(b.d));
            var taken = new List<Rect>();
            foreach (var (m, d, rel) in ahead)
            {
                float x = center + rel / HalfFov * half;
                string text = $"{Name(m)} {Mathf.RoundToInt(d)} m";
                Vector2 size = small.CalcSize(new GUIContent(text));
                var rect = new Rect(x - size.x / 2f, 0f, size.x, size.y);
                // Below the strip, on one of two rows
                bool placed = false;
                for (int row = 0; row < 2 && !placed; row++)
                {
                    rect.y = strip.yMax + (2f + row * 20f) * s;
                    if (!Overlaps(taken, rect)) placed = true;
                }
                if (!placed) continue;
                taken.Add(rect);
                // Tick on the strip where the marker is
                GUI.color = m.stash ? StashColor : LootColor;
                GUI.DrawTexture(new Rect(x - 1.5f * s, strip.y + strip.height * 0.55f, 3f * s, strip.height * 0.45f), Texture2D.whiteTexture);
                GUI.color = Color.white;
                Shadowed(rect, text, small, m.stash ? StashColor : LootColor);
            }
        }

        static readonly Color LootColor = new Color(0.95f, 0.85f, 0.55f, 1f);
        static readonly Color StashColor = new Color(0.6f, 0.85f, 1f, 1f);

        static string Name(HudMarker m)
        {
            string name = m.quantity > 1 ? $"{m.name} x{m.quantity}" : m.name;
            return m.inside != null && m.x != null ? $"{name} (in {m.inside})" : name;
        }

        static bool Overlaps(List<Rect> taken, Rect r)
        {
            foreach (var t in taken) if (t.Overlaps(r)) return true;
            return false;
        }

        void EnsureStyles()
        {
            float scale = Mathf.Max(0.75f, Screen.height / 1080f);
            if (label != null && Mathf.Approximately(scale, styleScale)) return;
            styleScale = scale;
            label = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = Mathf.RoundToInt(16 * scale), fontStyle = FontStyle.Bold };
            small = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.UpperCenter, fontSize = Mathf.RoundToInt(14 * scale) };
        }

        /// <summary>Text with a dark outline, readable on snow.</summary>
        static void Shadowed(Rect rect, string text, GUIStyle style, Color color)
        {
            style.normal.textColor = new Color(0f, 0f, 0f, 0.8f * color.a);
            GUI.Label(new Rect(rect.x + 1, rect.y + 1, rect.width, rect.height), text, style);
            style.normal.textColor = color;
            GUI.Label(rect, text, style);
        }

        /// <summary>Menus, the map, inventory and other overlays cover the screen: no HUD then.</summary>
        static bool Hidden()
        {
            try
            {
                return GameManager.m_IsPaused || InterfaceManager.IsOverlayActiveCached();
            }
            catch
            {
                return false;
            }
        }

        // Filled by the JSON reader
#pragma warning disable CS0649
        /// <summary>shared/utils/hud.ts HudData.</summary>
        public sealed class HudData
        {
            public string run;
            public List<HudMarker> markers;
        }

        public sealed class HudMarker
        {
            public string name;
            public int quantity;
            public bool stash;
            public string inside;
            public double? x;
            public double? z;
        }
#pragma warning restore CS0649
    }
}
