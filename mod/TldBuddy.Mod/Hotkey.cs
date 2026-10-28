using System.Runtime.InteropServices;

namespace TldBuddy.Mod
{
    /// <summary>
    /// A key read straight from Windows (GetAsyncKeyState), so it works whatever input system the
    /// game uses. Fires once per press, and only while the game window has focus.
    /// </summary>
    sealed class Hotkey
    {
        [DllImport("user32.dll")]
        static extern short GetAsyncKeyState(int virtualKey);

        readonly int virtualKey;
        bool wasDown;

        public string Name { get; }

        Hotkey(string name, int virtualKey)
        {
            Name = name;
            this.virtualKey = virtualKey;
        }

        /// <summary>"F1".."F12", a letter or a digit (US layout). Null for anything else.</summary>
        public static Hotkey Parse(string name)
        {
            string key = (name ?? "").Trim().ToUpperInvariant();
            if (key.Length >= 2 && key[0] == 'F' && int.TryParse(key.Substring(1), out int n) && n >= 1 && n <= 12)
            {
                return new Hotkey(key, 0x70 + n - 1); // VK_F1 = 0x70
            }
            if (key.Length == 1 && (char.IsLetter(key[0]) || char.IsDigit(key[0])) && key[0] < 128)
            {
                return new Hotkey(key, key[0]); // VK codes of A–Z and 0–9 are their ASCII codes
            }
            return null;
        }

        /// <summary>True on the frame the key goes down.</summary>
        public bool Pressed(bool gameFocused)
        {
            bool down = (GetAsyncKeyState(virtualKey) & 0x8000) != 0;
            bool pressed = down && !wasDown && gameFocused;
            wasDown = down;
            return pressed;
        }
    }
}
