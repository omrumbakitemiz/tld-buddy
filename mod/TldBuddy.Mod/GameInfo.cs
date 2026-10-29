using Il2Cpp;
using MelonLoader;

namespace TldBuddy.Mod
{
    /// <summary>The save being played, and the in-game time, weather and condition.</summary>
    static class GameInfo
    {
        static string warned;

        /// <summary>
        /// The save's id: slot type and game id ("Sandbox-12"). Every save of one playthrough
        /// (auto, quick, manual) shares it. Null in the menu or when the game can't tell.
        /// </summary>
        public static string SaveId(MelonLogger.Instance log)
        {
            try
            {
                uint gameId = SaveGameSystem.m_CurrentGameId;
                if (gameId == 0) return null;
                return $"{SaveGameSystem.m_CurrentGameMode}-{gameId}";
            }
            catch (System.Exception e)
            {
                WarnOnce(log, "save id", e);
                return null;
            }
        }

        public static Save CurrentSave(MelonLogger.Instance log)
        {
            string id = SaveId(log);
            if (id == null) return null;
            string name = "";
            string mode = null;
            try
            {
                string slot = SaveGameSystem.GetCurrentSaveName();
                if (!string.IsNullOrEmpty(slot)) name = SaveGameSlots.GetUserDefinedSlotName(slot) ?? "";
                if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrEmpty(slot)) name = SaveGameSlots.GetSaveSlotFromName(slot)?.m_DisplayName ?? "";
                mode = ExperienceModeManager.GetCurrentExperienceModeType().ToString();
            }
            catch (System.Exception e)
            {
                WarnOnce(log, "save name", e);
            }
            name = name.Trim();
            if (name.Length > 60) name = name.Substring(0, 60);
            return new Save(id, name, mode);
        }

        public static World CurrentWorld(MelonLogger.Instance log)
        {
            try
            {
                var tod = GameManager.GetTimeOfDayComponent();
                var weather = GameManager.GetWeatherComponent();
                var wind = GameManager.GetWindComponent();
                var condition = GameManager.GetConditionComponent();
                if (tod == null || weather == null || condition == null) return null;
                return new World
                {
                    day = System.Math.Max(1, tod.GetDayNumber()),
                    hour = System.Math.Clamp(tod.GetHour(), 0, 23),
                    minute = System.Math.Clamp(tod.GetMinutes(), 0, 59),
                    weather = weather.GetWeatherStage().ToString(),
                    airC = Round(weather.GetCurrentTemperature()),
                    feelsC = Round(weather.GetCurrentTemperatureWithWindchill()),
                    windMph = wind != null ? Round(System.Math.Max(0f, wind.GetSpeedMPH())) : 0,
                    condition = Round(System.Math.Clamp(condition.GetNormalizedCondition() * 100f, 0f, 100f)),
                };
            }
            catch (System.Exception e)
            {
                // A game update renaming these should cost the status line, not the position
                WarnOnce(log, "time and weather", e);
                return null;
            }
        }

        static double Round(float v) => System.Math.Round(v, 1);

        static void WarnOnce(MelonLogger.Instance log, string what, System.Exception e)
        {
            if (warned != null && warned.Contains(what)) return;
            warned += what + ";";
            log.Warning($"Could not read the {what}: {e.Message}");
        }

        /// <summary>shared/utils/live.ts LiveSave.</summary>
        public sealed class Save
        {
            public string id;
            public string name;
            public string mode;

            public Save(string id, string name, string mode)
            {
                this.id = id;
                this.name = name;
                this.mode = mode;
            }
        }

        /// <summary>shared/utils/live.ts LiveWorld.</summary>
        public sealed class World
        {
            public int day, hour, minute;
            public string weather;
            public double airC, feelsC, windMph, condition;
        }
    }
}
