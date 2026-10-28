import { ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/**
 * Seam between the app shell / map and the add-item variant being tried
 * (docs/add-item/CONCEPTS.md). Pick one with `?addui=legacy|a|b|c|d` or the menu;
 * the choice is kept per device.
 */

export const ADD_VARIANTS = [
  { id: 'legacy', label: 'Current dialog' },
  { id: 'a', label: 'A · Wheel' },
  { id: 'b', label: 'B · Field note' },
  { id: 'c', label: 'C · Rummage' },
  { id: 'd', label: 'D · Satchel' },
] as const

export type AddVariant = (typeof ADD_VARIANTS)[number]['id']

const isVariant = (v: unknown): v is AddVariant => ADD_VARIANTS.some((x) => x.id === v)

/** Map position in image pixels (x right, y up, as stored on markers). */
export interface MapPos { x: number; y: number }

export interface AddRequest {
  /** Where on the map */
  pos: MapPos
  /** Same point in viewport (client) pixels, for anchoring overlays */
  client: { x: number; y: number }
  source: 'key' | 'button' | 'placing' | 'shift-click' | 'context' | 'palette' | 'panel'
}

export interface AddVariantHandlers {
  /** `A`, the Add loot button, the palette or the panel asked to add. `req` is null when the pointer isn't over the map. */
  start?: (req: AddRequest | null) => void
  /** The map asked to add at a point (right-click, long-press, Shift-click, or a click while placing). */
  request?: (req: AddRequest) => void
  /** Called on every plain map click first; return true to swallow it (stamp modes). */
  interceptClick?: (req: AddRequest, e: MouseEvent) => boolean
}

/** Projection helpers published by the main map once it exists. */
export interface MapView {
  /** Map position → viewport (client) pixels */
  toClient: (pos: MapPos) => { x: number; y: number }
  /** Viewport (client) pixels → map position, or null when outside the map */
  fromClient: (client: { x: number; y: number }) => MapPos | null
  /** The map's DOM element (for bounds, focus and drop targets) */
  container: HTMLElement
  /** Pan so a position is visible, keeping `margin` px clear */
  reveal: (pos: MapPos, margin?: number) => void
}

const stored = useLocalStorage<AddVariant>('tld-buddy-add-ui', 'legacy')
const variant = ref<AddVariant>('legacy')
let initialised = false

/** Last pointer position over the map, or null when the pointer left it. */
const pointer = shallowRef<{ pos: MapPos; client: { x: number; y: number } } | null>(null)
const mapView = shallowRef<MapView | null>(null)
/** Bumps on every map move/zoom so anchored overlays can reposition. */
const viewTick = ref(0)
/** A variant has an add UI open and wants the keyboard (shell single-key shortcuts pause). */
const active = ref(false)
/** A variant replaces the floating Add loot button with its own chrome. */
const hideAddButton = ref(false)

let handlers: AddVariantHandlers | null = null

/** Shared "Added …" toast with Undo (AddToast.vue). */
const notice = ref<{ id: number; text: string; batchId: string | null } | null>(null)
let noticeSeq = 0
function announce(text: string, batchId: string | null = null) {
  notice.value = { id: ++noticeSeq, text, batchId }
}

function setVariant(v: AddVariant) {
  variant.value = v
  stored.value = v
}

/** Register the current variant's handlers; returns the unregister function. */
function register(h: AddVariantHandlers) {
  handlers = h
  return () => {
    if (handlers === h) handlers = null
    active.value = false
    hideAddButton.value = false
  }
}

export function useAddUi() {
  if (!initialised && typeof window !== 'undefined') {
    initialised = true
    const fromQuery = new URLSearchParams(window.location.search).get('addui')
    variant.value = isVariant(fromQuery) ? fromQuery : isVariant(stored.value) ? stored.value : 'legacy'
    if (isVariant(fromQuery)) stored.value = fromQuery
  }
  return {
    variant,
    setVariant,
    pointer,
    mapView,
    viewTick,
    active,
    hideAddButton,
    register,
    handlers: () => handlers,
    notice,
    announce,
  }
}
