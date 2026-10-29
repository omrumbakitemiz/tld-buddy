// What the game mod's in-game HUD shows: the run's markers near the player, in world coordinates.
// Computed on the server from the saved markers (map x/y) and the map calibration.

import { getVariantKey, type AppData, type GameMap, type GameScene, type Marker } from '../types/game'
import { invertTransform, sceneLabel, sceneTransform, type MapCalibration } from './live'

export interface HudMarker {
  name: string
  quantity: number
  /** A stash the player made (dropped or stored), rather than loot they found. */
  stash: boolean
  /** Building the marker is inside (it sits on its door outside), e.g. "Camp Office". */
  inside: string | null
  /** World position in the player's current scene; null indoors (the markers of this building). */
  x: number | null
  z: number | null
}

/** Body of GET /api/live/v1/hud. */
export interface HudData {
  /** Run the markers come from, or null when no run is linked to the save. */
  run: string | null
  markers: HudMarker[]
}

export const MAX_HUD_MARKERS = 100
const INSIDE = /(?:^| · )Inside (.+?)(?: · |$)/

const isStash = (note: string | undefined) => !!note && /(?:^| · )(?:Dropped|Stored in |Stashed)/.test(note)
const insideOf = (note: string | undefined) => note?.match(INSIDE)?.[1] ?? null

/**
 * The run of `save` (the linked one; else the current run unless it tracks another save, as in
 * the app), and its unlooted markers relevant where the player is: on the map of a calibrated
 * region, the nearest ones with their world position; inside a building, the ones noted inside it.
 */
export function hudData(
  data: AppData,
  save: string,
  here: { scene: string; x: number; z: number },
  scenes: GameScene[],
  calibration: MapCalibration,
  maps: GameMap[],
): HudData {
  const current = data.runs.find((r) => r.id === data.currentRunId)
  const run = data.runs.find((r) => r.gameSave === save) ?? (current && !current.gameSave ? current : undefined)
  if (!run) return { run: null, markers: [] }
  const open = data.markers.filter((m) => m.runId === run.id && !m.lootedAt)
  const view = (m: Marker, x: number | null, z: number | null): HudMarker => ({
    name: m.name, quantity: m.quantity, stash: isStash(m.note), inside: insideOf(m.note), x, z,
  })

  const region = scenes.find((s) => s.scene === here.scene)
  if (!region) {
    const building = sceneLabel(here.scene)
    return { run: run.name, markers: open.filter((m) => insideOf(m.note) === building).slice(0, MAX_HUD_MARKERS).map((m) => view(m, null, null)) }
  }
  const variant = getVariantKey(run.difficulty)
  const image = maps.find((m) => m.id === region.mapId)?.[variant]
  const t = sceneTransform(calibration, here.scene, variant, image)
  if (!t) return { run: run.name, markers: [] }
  const placed: { marker: HudMarker; d: number }[] = []
  for (const m of open) {
    if (m.mapId !== region.mapId) continue
    const w = invertTransform(t, m.x, m.y)
    if (!w) continue
    const x = Math.round(w.x * 10) / 10, z = Math.round(w.z * 10) / 10
    placed.push({ marker: view(m, x, z), d: Math.hypot(x - here.x, z - here.z) })
  }
  placed.sort((a, b) => a.d - b.d)
  return { run: run.name, markers: placed.slice(0, MAX_HUD_MARKERS).map((p) => p.marker) }
}
