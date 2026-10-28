using Il2Cpp;

namespace TldBuddy.Mod
{
    static class Gear
    {
        /// <summary>"GEAR_Hatchet(Clone)" → "GEAR_Hatchet"; only characters the server accepts.</summary>
        public static string PrefabName(string objectName)
        {
            var chars = new System.Text.StringBuilder();
            foreach (char c in objectName ?? "")
            {
                if (c == '(' || c == ' ') break;
                if (char.IsLetterOrDigit(c) && c < 128 || c == '_') chars.Append(c);
            }
            return chars.Length > 0 && chars.Length <= 80 ? chars.ToString() : null;
        }

        /// <summary>Units in a stack (arrows, matches), 1 for single items.</summary>
        public static int Units(GearItem gi) => gi.m_StackableItem != null ? gi.m_StackableItem.m_Units : 1;
    }
}
