using System.Collections.Generic;
using HarmonyLib;
using Il2Cpp;
using MelonLoader;

namespace TldBuddy.Mod
{
    /// <summary>
    /// Items the player picks up or puts down, collected from the game's own methods (Harmony
    /// patches below) and taken by the mod once a tick to send as pickup and drop events:
    /// - pickup: anything entering the inventory from the world or an open container
    /// - drop: an item dropped on the ground, or moved into the open container
    /// Nothing is recorded while a save loads or a scene settles: the inventory is filled then too.
    /// </summary>
    static class ItemEvents
    {
        /// <summary>Set by the mod: in a gameplay scene that has settled after loading.</summary>
        public static bool Ready;
        public static MelonLogger.Instance Log;

        static readonly List<Entry> pending = new List<Entry>();
        /// <summary>Container whose panel is open, and the name the game shows for it.</summary>
        static Container openContainer;
        static string openContainerName;

        public sealed class Entry
        {
            public string type; // "pickup" or "drop"
            public string container;
            public string name;
            public string gearName;
            public int quantity;
        }

        public static bool HasPending => pending.Count > 0;

        public static List<Entry> TakeAll()
        {
            var all = new List<Entry>(pending);
            pending.Clear();
            return all;
        }

        public static void Discard() => pending.Clear();

        static bool Recording
        {
            get
            {
                if (!Ready) return false;
                try
                {
                    return !SaveGameSystem.IsRestoreInProgress();
                }
                catch
                {
                    return true;
                }
            }
        }

        static bool ContainerOpen => openContainer != null;

        /// <summary>Reads the item right away: a picked up stack may be merged and destroyed next.</summary>
        static void Record(string type, GearItem gi, int units, string container)
        {
            try
            {
                if (gi == null) return;
                string name = gi.DisplayName;
                if (string.IsNullOrWhiteSpace(name)) return;
                pending.Add(new Entry
                {
                    type = type,
                    container = container,
                    name = name.Trim(),
                    gearName = Gear.PrefabName(gi.name),
                    quantity = UnityEngine.Mathf.Clamp(units, 1, 9999),
                });
            }
            catch (System.Exception e)
            {
                // A game update changing these APIs should cost this event, not the game
                Log?.Warning($"Could not read a {type}: {e.Message}");
            }
        }

        [HarmonyPatch(typeof(Inventory), nameof(Inventory.AddGear))]
        static class InventoryAddGear
        {
            static void Prefix(GearItem gi)
            {
                if (!Recording || gi == null || gi.m_InPlayerInventory) return;
                Record("pickup", gi, Gear.Units(gi), ContainerOpen ? openContainerName : null);
            }
        }

        [HarmonyPatch(typeof(GearItem), nameof(GearItem.Drop))]
        static class GearItemDrop
        {
            static void Prefix(GearItem __instance, int numUnits)
            {
                // Moving into a container is recorded by Container.AddGear, with its name
                if (!Recording || ContainerOpen || __instance == null || !__instance.m_InPlayerInventory) return;
                Record("drop", __instance, numUnits, null);
            }
        }

        [HarmonyPatch(typeof(Container), nameof(Container.AddGear))]
        static class ContainerAddGear
        {
            static void Prefix(Container __instance, GearItem gi)
            {
                // Only what the player moves in: containers also fill up while their loot is rolled
                if (!Recording || !ContainerOpen || __instance == null || __instance.Pointer != openContainer.Pointer) return;
                Record("drop", gi, Gear.Units(gi), openContainerName);
            }
        }

        [HarmonyPatch(typeof(Panel_Container), nameof(Panel_Container.SetContainer))]
        static class PanelContainerSet
        {
            static void Postfix(Container c, string displayName)
            {
                openContainer = c;
                openContainerName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
            }
        }

        [HarmonyPatch(typeof(Panel_Container), nameof(Panel_Container.Enable), new[] { typeof(bool) })]
        static class PanelContainerEnable
        {
            static void Postfix(bool enable)
            {
                if (!enable) openContainer = null;
            }
        }

        [HarmonyPatch(typeof(Panel_Container), nameof(Panel_Container.Enable), new[] { typeof(bool), typeof(bool), typeof(Il2CppSystem.Action) })]
        static class PanelContainerEnableWithCallback
        {
            static void Postfix(bool enable)
            {
                if (!enable) openContainer = null;
            }
        }
    }
}
