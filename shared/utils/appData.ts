import type { AppData, Marker, POIPin, Run, StashedItem } from '../types/game'

export const MAX_RECENT_MAPS = 10

export function createDefaultAppData(): AppData {
  return {
    runs: [],
    currentRunId: null,
    currentMapId: null,
    markers: [],
    enabledPOIs: [],
    poiPins: [],
    stashedItems: [],
    recentMapIds: [],
    travelMode: false,
    travelLeftMapId: null,
    travelRightMapId: null,
  }
}

type Loose = Record<string, unknown>

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}
const objects = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter(isObject) : [])
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : [])

/**
 * Read any historical shape of `app-data` into the current AppData shape.
 *
 * This is the single migration point: every load (Redis, localStorage, conflict
 * responses) goes through it. It never drops a record that has an id; unknown
 * fields on records are kept so older and newer clients can round-trip data.
 */
export function normalizeAppData(raw: unknown): AppData {
  const d = isObject(raw) ? raw : {}

  const runs = objects(d.runs)
    .filter((r) => str(r.id))
    .map((r) => ({ ...r, name: String(r.name ?? 'Run'), createdAt: num(r.createdAt, 0) }) as Run)

  const markers = objects(d.markers)
    .filter((m) => str(m.id))
    .map((m) => ({
      ...m,
      x: num(m.x, 0),
      y: num(m.y, 0),
      quantity: Math.max(1, Math.round(num(m.quantity, 1))),
      name: String(m.name ?? ''),
      lootedAt: m.lootedAt == null ? null : num(m.lootedAt, Date.now()),
    }) as Marker)

  const poiPins = objects(d.poiPins)
    .filter((p) => str(p.poiId))
    .map((p) => ({ ...p, x: num(p.x, 0), y: num(p.y, 0) }) as POIPin)

  const stashedItems = objects(d.stashedItems)
    .filter((s) => str(s.id))
    .map((s) => ({ ...s, quantity: Math.max(1, Math.round(num(s.quantity, 1))) }) as StashedItem)

  return {
    runs,
    currentRunId: str(d.currentRunId),
    currentMapId: str(d.currentMapId),
    markers,
    enabledPOIs: strings(d.enabledPOIs),
    poiPins: dedupeBy(poiPins, (p) => p.poiId),
    stashedItems,
    recentMapIds: strings(d.recentMapIds).slice(0, MAX_RECENT_MAPS),
    travelMode: d.travelMode === true,
    travelLeftMapId: str(d.travelLeftMapId),
    travelRightMapId: str(d.travelRightMapId),
  }
}

/** Structural check used by the API before it overwrites stored data. */
export function isAppDataPayload(raw: unknown): boolean {
  if (!isObject(raw)) return false
  const arrays = ['runs', 'markers', 'enabledPOIs', 'poiPins', 'stashedItems', 'recentMapIds'] as const
  return arrays.every((k) => raw[k] === undefined || Array.isArray(raw[k]))
    && Array.isArray(raw.runs)
    && Array.isArray(raw.markers)
}

function dedupeBy<T>(list: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ── Three-way merge ─────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Merge records keyed by id. A side "changed" a record when it differs from base.
 * Both changed → field-level merge, local wins per conflicting field.
 * Deleted on one side but edited on the other → the edit survives (never lose work).
 */
function mergeRecords<T extends object>(base: T[], local: T[], remote: T[], key: (t: T) => string): T[] {
  const b = new Map(base.map((t) => [key(t), t]))
  const l = new Map(local.map((t) => [key(t), t]))
  const r = new Map(remote.map((t) => [key(t), t]))
  const out: T[] = []

  const resolve = (id: string): T | null => {
    const bv = b.get(id)
    const lv = l.get(id)
    const rv = r.get(id)
    if (lv && rv) {
      if (same(lv, rv)) return lv
      if (!bv) return lv
      if (same(lv, bv)) return rv
      if (same(rv, bv)) return lv
      const merged: Record<string, unknown> = { ...(rv as unknown as Record<string, unknown>) }
      const lr = lv as unknown as Record<string, unknown>
      const br = bv as unknown as Record<string, unknown>
      for (const f of Object.keys(lr)) {
        if (!same(lr[f], br[f])) merged[f] = lr[f]
      }
      return merged as T
    }
    if (lv) return bv && same(lv, bv) ? null : lv // remote deleted unchanged record
    if (rv) return bv && same(rv, bv) ? null : rv // local deleted unchanged record
    return null
  }

  for (const id of r.keys()) {
    const v = resolve(id)
    if (v) out.push(v)
  }
  for (const id of l.keys()) {
    if (r.has(id)) continue
    const v = resolve(id)
    if (v) out.push(v)
  }
  return out
}

/** Set-like string lists: keep remote, apply local additions and removals relative to base. */
function mergeSet(base: string[], local: string[], remote: string[]): string[] {
  const b = new Set(base)
  const l = new Set(local)
  const removedLocally = new Set(base.filter((x) => !l.has(x)))
  const addedLocally = local.filter((x) => !b.has(x))
  const kept = remote.filter((x) => !removedLocally.has(x))
  return [...new Set([...addedLocally, ...kept])]
}

function mergeScalar<T>(base: T, local: T, remote: T): T {
  return same(local, base) ? remote : local
}

/**
 * Three-way merge of the user's data: `base` is the last version both sides agreed
 * on, `local` has this device's unsynced edits, `remote` is what the server holds now.
 */
export function mergeAppData(base: AppData, local: AppData, remote: AppData): AppData {
  const runs = mergeRecords(base.runs, local.runs, remote.runs, (r) => r.id)
  const runIds = new Set(runs.map((r) => r.id))

  const merged: AppData = {
    runs,
    markers: mergeRecords(base.markers, local.markers, remote.markers, (m) => m.id)
      .filter((m) => runIds.has(m.runId)),
    stashedItems: mergeRecords(base.stashedItems, local.stashedItems, remote.stashedItems, (s) => s.id)
      .filter((s) => runIds.has(s.runId)),
    poiPins: mergeRecords(base.poiPins, local.poiPins, remote.poiPins, (p) => p.poiId),
    enabledPOIs: mergeSet(base.enabledPOIs, local.enabledPOIs, remote.enabledPOIs),
    recentMapIds: mergeSet(base.recentMapIds, local.recentMapIds, remote.recentMapIds).slice(0, MAX_RECENT_MAPS),
    currentRunId: mergeScalar(base.currentRunId, local.currentRunId, remote.currentRunId),
    currentMapId: mergeScalar(base.currentMapId, local.currentMapId, remote.currentMapId),
    travelMode: mergeScalar(base.travelMode, local.travelMode, remote.travelMode),
    travelLeftMapId: mergeScalar(base.travelLeftMapId, local.travelLeftMapId, remote.travelLeftMapId),
    travelRightMapId: mergeScalar(base.travelRightMapId, local.travelRightMapId, remote.travelRightMapId),
  }

  if (merged.currentRunId && !runIds.has(merged.currentRunId)) {
    merged.currentRunId = runs[0]?.id ?? null
  }
  return merged
}

/** Short random id with a readable prefix, unique even for same-millisecond creation. */
export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${rand}`
}
