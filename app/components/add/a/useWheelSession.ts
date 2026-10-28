import { computed, ref, type Ref } from 'vue'
import { useAddItem } from '~/composables/useAddItem'
import { useGameData } from '~/composables/useGameData'
import { useStaticData } from '~/composables/useStaticData'
import type { Spot } from '~/lib/addItem'
import type { Item } from '~/types'
import { contribution, ownsMarker, summarise, type WheelPick } from './wheel'

/**
 * What one open wheel has written: its picks, the undo batch they share, and the edits a
 * wheel makes after the fact (quantity, take back, note). Every pick is a real marker at
 * once; edits go through `amend` so the batch (and Ctrl+Z / the toast's Undo) stays exact.
 */
export function useWheelSession(spot: Ref<Spot>) {
  const addItem = useAddItem()
  const game = useGameData()
  const { itemsById } = useStaticData()

  const picks = ref<WheelPick[]>([])
  let batchId: string | null = null
  /** Markers this wheel created; anything else a pick lands on was there before */
  const created = new Set<string>()

  const nameOf = (itemId: string) => itemsById.value.get(itemId)?.name ?? 'Loot'
  const last = computed(() => picks.value.at(-1) ?? null)
  const lastItem = computed<Item | null>(() => (last.value ? itemsById.value.get(last.value.itemId) ?? null : null))

  function reset() {
    picks.value = []
    batchId = null
    created.clear()
  }

  /** Add one item (qty 1 unless the search line said otherwise). Returns false when nothing was written. */
  function pick(item: Item, opts: { quantity?: number; note?: string } = {}): boolean {
    const quantity = Math.max(1, opts.quantity ?? 1)
    const note = opts.note?.trim() || undefined
    const before = new Set(addItem.markersAt(spot.value).map((m) => m.id))
    const res = addItem.addAt(spot.value, [{ itemId: item.id, quantity, note }], batchId ? { batchId } : {})
    const marker = res?.markers[0]
    if (!res || !marker) return false
    batchId = res.batchId
    if (!before.has(marker.id)) created.add(marker.id)
    picks.value.push({ itemId: item.id, markerId: marker.id, quantity, stacked: !created.has(marker.id) })
    return true
  }

  /** Give the last pick a new quantity. */
  function setLastQuantity(quantity: number) {
    const p = last.value
    if (!p || !batchId || p.quantity === quantity) return
    p.quantity = quantity
    addItem.amend(batchId, p.markerId, contribution(picks.value, p.markerId))
  }

  /** Take the last pick back out. Returns its item name, or null when there was nothing. */
  function removeLast(): string | null {
    const p = picks.value.pop()
    if (!p || !batchId) return null
    addItem.amend(batchId, p.markerId, contribution(picks.value, p.markerId))
    return nameOf(p.itemId)
  }

  /** The note on the last pick's marker. */
  const lastNote = computed(() => {
    const p = last.value
    return p ? game.markers.value.find((m) => m.id === p.markerId)?.note ?? '' : ''
  })

  /** Put a note on the last pick. A pick that shares its marker gets its own (notes never stack). */
  function noteLast(text: string) {
    const p = last.value
    const note = text.trim()
    if (!p || !batchId || lastNote.value === note) return
    if (ownsMarker(picks.value, p)) {
      game.updateMarker(p.markerId, { note })
      return
    }
    addItem.amend(batchId, p.markerId, contribution(picks.value, p.markerId) - p.quantity)
    const res = addItem.addAt(spot.value, [{ itemId: p.itemId, quantity: p.quantity, note }], { batchId })
    const m = res?.markers[0]
    if (!m) return
    created.add(m.id)
    p.markerId = m.id
    p.stacked = false
  }

  /** "Wood Matches ×12, Hatchet and 3 more", or null when nothing was added. */
  function summary(): { text: string; batchId: string } | null {
    if (!picks.value.length || !batchId) return null
    return { text: summarise(picks.value.map((p) => ({ name: nameOf(p.itemId), quantity: p.quantity }))), batchId }
  }

  /** Markers this wheel touched (created or stacked onto) */
  const touched = computed(() => new Set(picks.value.map((p) => p.markerId)))

  return { picks, last, lastItem, lastNote, touched, reset, pick, setLastQuantity, removeLast, noteLast, summary, nameOf }
}
