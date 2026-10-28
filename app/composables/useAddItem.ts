import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { createId } from '#shared/utils/appData'
import type { Item, Marker } from '~/types'
import {
  LOOT_GROUPS, SPOT_RADIUS, computeFrecency, foldText, likelyItemIdsForPOI, markersAtSpot, nearestSpot, planBatch, rankItems, topByFrecency,
  type BatchEntry, type LootGroupId, type Spot,
} from '~/lib/addItem'
import { useAddUi } from './useAddUi'
import { useGameData } from './useGameData'
import { useStaticData } from './useStaticData'

/**
 * Data side of adding items, shared by every add-item variant (docs/add-item/CONCEPTS.md).
 * Variants own the interaction; this owns where markers land, stacking, undo and ranking.
 */

interface BatchRecord {
  id: string
  runId: string
  mapId: string
  added: string[]
  stacked: { markerId: string; add: number }[]
  at: number
}

/** Undo stack for this tab (not synced: undo is about what *you* just did here). */
const batches = ref<BatchRecord[]>([])
const lastItemId = useLocalStorage<string | null>('tld-buddy-add-last-item', null)

export function useAddItem() {
  const game = useGameData()
  const { itemsById } = useStaticData()
  const addUi = useAddUi()

  const frecency = computed(() => computeFrecency(game.currentRunMarkers.value))

  /** Search all items: prefix first, then frecency. */
  function search(query: string, opts: { group?: LootGroupId; limit?: number } = {}): Item[] {
    const group = opts.group ? LOOT_GROUPS.find((g) => g.id === opts.group) : undefined
    return rankItems(game.items.value, query, {
      frecency: frecency.value,
      only: group ? new Set<string>(group.items) : undefined,
      limit: opts.limit,
    })
  }

  /** This run's most-used items. */
  function frecent(n = 8): Item[] {
    return topByFrecency(frecency.value, itemsById.value, n)
  }

  /** A curated group's items, most-used first, keeping the curated order for ties. */
  function groupItems(groupId: LootGroupId, n?: number): Item[] {
    const group = LOOT_GROUPS.find((g) => g.id === groupId)
    if (!group) return []
    const fre = frecency.value
    const list = group.items
      .map((id, i) => ({ item: itemsById.value.get(id), i }))
      .filter((x): x is { item: Item; i: number } => !!x.item)
      .sort((a, b) => (fre.get(b.item.id) ?? 0) - (fre.get(a.item.id) ?? 0) || a.i - b.i)
      .map((x) => x.item)
    return n ? list.slice(0, n) : list
  }

  /** Suggestions for a place: likely items for its kind blended with this run's habits. */
  function likelyItems(poiId: string | undefined, n = 16): Item[] {
    const poi = poiId ? game.getPOIById(poiId) : undefined
    const ids = [...new Set([...frecent(6).map((i) => i.id), ...likelyItemIdsForPOI(poi)])]
    return ids.map((id) => itemsById.value.get(id)).filter((i): i is Item => !!i).slice(0, n)
  }

  const lastItem = computed(() => (lastItemId.value ? itemsById.value.get(lastItemId.value) ?? null : null))

  /**
   * Snap a map position to a pinned place or an existing pile nearby: within 40 map px or
   * 28 screen px, whichever is larger, so a click just beside a tile joins its pile at any zoom.
   */
  function resolveSpot(pos: { x: number; y: number }): Spot & { snapped: 'poi' | 'marker' | null } {
    const radius = Math.max(SPOT_RADIUS, 28 * (addUi.mapView.value?.scale() ?? 1))
    return nearestSpot(pos, game.currentMapPOIPins.value, game.currentMapMarkers.value, radius)
  }

  /** Markers of the current run and map at a spot. */
  function markersAt(spot: { x: number; y: number }): Marker[] {
    return markersAtSpot(spot, game.currentMapMarkers.value)
  }

  /**
   * Add items at a spot on the current map. Same item at the same spot stacks onto the
   * existing unlooted marker. Pass `batchId` to extend an open batch (one undo step for a
   * whole wheel/session); returns the batch id and the markers touched.
   */
  function addAt(spot: { x: number; y: number }, entries: BatchEntry[], opts: { batchId?: string } = {}) {
    const run = game.currentRun.value
    const map = game.currentMap.value
    if (!run || !map || !entries.length) return null

    let batch = opts.batchId ? batches.value.find((b) => b.id === opts.batchId) : undefined
    if (!batch) {
      batch = { id: opts.batchId ?? createId('batch'), runId: run.id, mapId: map.id, added: [], stacked: [], at: Date.now() }
      batches.value.push(batch)
      if (batches.value.length > 30) batches.value.shift()
    }

    const touched: Marker[] = []
    for (const op of planBatch(spot, entries, game.currentMapMarkers.value)) {
      if (op.kind === 'stack') {
        const m = game.markers.value.find((x) => x.id === op.markerId)
        if (!m) continue
        game.updateMarker(m.id, { quantity: m.quantity + op.add })
        batch.stacked.push({ markerId: m.id, add: op.add })
        touched.push(m)
      } else {
        const m = game.addMarker({
          runId: run.id,
          mapId: map.id,
          itemId: op.itemId,
          name: itemsById.value.get(op.itemId)?.name ?? 'Loot',
          x: op.x,
          y: op.y,
          quantity: op.quantity,
          note: op.note,
        })
        batch.added.push(m.id)
        touched.push(m)
      }
    }
    lastItemId.value = entries[entries.length - 1]!.itemId
    return { batchId: batch.id, markers: touched }
  }

  /** Undo one batch (default: the latest). Returns how many markers it touched. */
  function undo(batchId?: string): number {
    const list = batches.value
    const idx = batchId ? list.findIndex((b) => b.id === batchId) : list.length - 1
    const batch = list[idx]
    if (!batch) return 0
    list.splice(idx, 1)
    for (const s of batch.stacked) {
      const m = game.markers.value.find((x) => x.id === s.markerId)
      if (m) game.updateMarker(m.id, { quantity: Math.max(1, m.quantity - s.add) })
    }
    for (const id of batch.added) game.deleteMarker(id)
    return batch.added.length + batch.stacked.length
  }

  /**
   * Change how much an open batch put on one marker (e.g. typing a quantity right after
   * an add, or taking the last pick back), keeping undo exact. For a marker the batch
   * created, `quantity` is its new quantity and 0 deletes it; for a marker it stacked
   * onto, it is the new amount added on top and 0 takes the stack back. A batch left
   * empty is dropped. Returns false when the batch didn't touch that marker.
   * (From the variant A builder.)
   */
  function amend(batchId: string, markerId: string, quantity: number): boolean {
    const idx = batches.value.findIndex((b) => b.id === batchId)
    const batch = batches.value[idx]
    if (!batch) return false
    const q = Math.max(0, Math.round(quantity))
    if (batch.added.includes(markerId)) {
      batch.stacked = batch.stacked.filter((s) => s.markerId !== markerId)
      if (q > 0) game.updateMarker(markerId, { quantity: q })
      else {
        batch.added = batch.added.filter((id) => id !== markerId)
        game.deleteMarker(markerId)
      }
    } else {
      const own = batch.stacked.filter((s) => s.markerId === markerId)
      if (!own.length) return false
      const m = game.markers.value.find((x) => x.id === markerId)
      const had = own.reduce((a, s) => a + s.add, 0)
      if (m) game.updateMarker(markerId, { quantity: Math.max(1, m.quantity - had + q) })
      batch.stacked = batch.stacked.filter((s) => s.markerId !== markerId)
      if (q > 0) batch.stacked.push({ markerId, add: q })
    }
    if (!batch.added.length && !batch.stacked.length) batches.value.splice(idx, 1)
    return true
  }

  const canUndo = computed(() => batches.value.length > 0)

  return {
    groups: LOOT_GROUPS,
    frecency,
    search,
    frecent,
    groupItems,
    likelyItems,
    lastItem,
    resolveSpot,
    markersAt,
    addAt,
    amend,
    undo,
    canUndo,
    foldText,
  }
}
