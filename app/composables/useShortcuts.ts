import { onBeforeUnmount, onMounted } from 'vue'

export interface Shortcut {
  /** KeyboardEvent.key, compared case-insensitively ("a", "/", "Escape", "Delete") */
  key: string
  /** Physical key (KeyboardEvent.code) that also triggers it, for layouts where `key` needs AltGr */
  code?: string
  mod?: boolean // Ctrl on Windows/Linux, ⌘ on macOS
  shift?: boolean
  /** Fire even while typing in an input (only sensible for mod-combos and Escape) */
  allowInInput?: boolean
  handler: (e: KeyboardEvent) => void
}

/** Display list for the shortcuts help dialog. */
export const SHORTCUT_HELP: { keys: string[]; label: string }[] = [
  { keys: ['/', 'Ctrl K'], label: 'Search items, places, loot and maps' },
  { keys: ['A'], label: 'Add loot (then click the map)' },
  { keys: ['Shift', 'click'], label: 'Add loot right where you click' },
  { keys: ['L'], label: 'Mark selected loot looted / back' },
  { keys: ['E'], label: 'Edit selected loot' },
  { keys: ['Del'], label: 'Delete selected loot' },
  { keys: ['H'], label: 'Hide or show looted markers' },
  { keys: ['N'], label: 'Night map: dim the map image' },
  { keys: ['P', '['], label: 'Collapse or expand the side panel' },
  { keys: ['1', '2', '3'], label: 'Panel: Loot, Places, Maps' },
  { keys: ['F'], label: 'Fit the whole map' },
  { keys: ['+', '−'], label: 'Zoom' },
  { keys: ['T'], label: 'Travel mode (two maps)' },
  { keys: ['R'], label: 'Runs' },
  { keys: ['Esc'], label: 'Cancel / deselect' },
  { keys: ['?'], label: 'This list' },
]

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function useShortcuts(shortcuts: () => Shortcut[]) {
  function onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.isComposing) return
    const typing = isTyping(e.target)
    // Leave keys alone while a dialog/sheet has focus, except the ones that ask otherwise
    const inDialog = !!(e.target as HTMLElement | null)?.closest?.('[role="dialog"]')
    for (const s of shortcuts()) {
      if (s.key.toLowerCase() !== e.key.toLowerCase() && !(s.code && s.code === e.code)) continue
      const mod = e.ctrlKey || e.metaKey
      if (!!s.mod !== mod) continue
      if (s.shift !== undefined && s.shift !== e.shiftKey) continue
      if ((typing || inDialog) && !s.allowInInput) continue
      if (e.altKey) continue
      e.preventDefault()
      s.handler(e)
      return
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
