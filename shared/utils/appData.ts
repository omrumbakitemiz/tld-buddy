import { DIFFICULTIES, type AppData, type Difficulty, type Marker, type POIPin, type Run, type StashedItem } from '../types/game'

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
const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v)

/**
 * Read any historical shape of `app-data` into the current AppData shape.
 *
 * This is the single migration point: every load (Redis, localStorage, conflict
 * responses) goes through it. Unknown fields on records are kept so older and newer
 * clients can round-trip data. Records without an id, duplicate ids, and markers or
 * stashes whose run no longer exists (unreachable in the UI) are dropped, so what
 * the client saves always passes `validateAppData`.
 */
export function normalizeAppData(raw: unknown): AppData {
  const d = isObject(raw) ? raw : {}

  const runs = dedupeBy(objects(d.runs).filter((r) => str(r.id)), (r) => r.id as string)
    .map((r) => ({
      ...r,
      name: String(r.name ?? 'Run'),
      difficulty: isDifficulty(r.difficulty) ? r.difficulty : 'voyageur',
      createdAt: num(r.createdAt, 0),
    }) as Run)
  const runIds = new Set(runs.map((r) => r.id))

  const markers = dedupeBy(objects(d.markers).filter((m) => str(m.id)), (m) => m.id as string)
    .filter((m) => runIds.has(m.runId as string) && str(m.mapId) && str(m.itemId))
    .map((m) => ({
      ...m,
      x: num(m.x, 0),
      y: num(m.y, 0),
      quantity: Math.max(1, Math.round(num(m.quantity, 1))),
      name: String(m.name ?? ''),
      lootedAt: m.lootedAt == null ? null : num(m.lootedAt, Date.now()),
    }) as Marker)

  const poiPins = dedupeBy(objects(d.poiPins).filter((p) => str(p.poiId)), (p) => p.poiId as string)
    .map((p) => ({ ...p, x: num(p.x, 0), y: num(p.y, 0) }) as POIPin)

  const stashedItems = dedupeBy(objects(d.stashedItems).filter((s) => str(s.id)), (s) => s.id as string)
    .filter((s) => runIds.has(s.runId as string) && str(s.poiId) && str(s.itemId))
    .map((s) => ({ ...s, quantity: Math.max(1, Math.round(num(s.quantity, 1))) }) as StashedItem)

  const currentRunId = str(d.currentRunId)
  return {
    runs,
    currentRunId: currentRunId && runIds.has(currentRunId) ? currentRunId : (runs[0]?.id ?? null),
    currentMapId: str(d.currentMapId),
    markers,
    enabledPOIs: strings(d.enabledPOIs),
    poiPins,
    stashedItems,
    recentMapIds: strings(d.recentMapIds).slice(0, MAX_RECENT_MAPS),
    travelMode: d.travelMode === true,
    travelLeftMapId: str(d.travelLeftMapId),
    travelRightMapId: str(d.travelRightMapId),
  }
}

// ── Validation (API, before overwriting stored data) ────────────────────────

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optString = (v: unknown) => v === undefined || v === null || typeof v === 'string'
const idString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200

/**
 * Strict check of a document a client wants to store. Returns an error message, or
 * null when valid. Rejects anything that could silently wipe or corrupt data
 * (non-object records, missing ids, duplicate ids, dangling run references, non-numeric
 * coordinates) while still accepting fields older builds omitted (stashes, pins,
 * recent maps, travel mode, notes, lootedAt).
 */
export function validateAppData(raw: unknown): string | null {
  if (!isObject(raw)) return 'body must be an object'
  if (!Array.isArray(raw.runs)) return 'runs must be an array'
  if (!Array.isArray(raw.markers)) return 'markers must be an array'
  for (const k of ['stashedItems', 'poiPins', 'enabledPOIs', 'recentMapIds'] as const) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) return `${k} must be an array`
  }
  for (const k of ['currentRunId', 'currentMapId', 'travelLeftMapId', 'travelRightMapId'] as const) {
    if (!optString(raw[k])) return `${k} must be a string or null`
  }
  if (raw.travelMode !== undefined && typeof raw.travelMode !== 'boolean') return 'travelMode must be a boolean'

  const runIds = new Set<string>()
  for (const [i, r] of (raw.runs as unknown[]).entries()) {
    if (!isObject(r)) return `runs[${i}] must be an object`
    if (!idString(r.id)) return `runs[${i}].id is missing`
    if (runIds.has(r.id)) return `runs[${i}].id is duplicated`
    if (r.name !== undefined && typeof r.name !== 'string') return `runs[${i}].name must be a string`
    if (!isDifficulty(r.difficulty)) return `runs[${i}].difficulty is invalid`
    if (r.createdAt !== undefined && !isFiniteNumber(r.createdAt)) return `runs[${i}].createdAt must be a number`
    runIds.add(r.id)
  }

  const markerIds = new Set<string>()
  for (const [i, m] of (raw.markers as unknown[]).entries()) {
    if (!isObject(m)) return `markers[${i}] must be an object`
    if (!idString(m.id)) return `markers[${i}].id is missing`
    if (markerIds.has(m.id)) return `markers[${i}].id is duplicated`
    if (!idString(m.runId) || !runIds.has(m.runId)) return `markers[${i}].runId does not match a run`
    if (!idString(m.mapId) || !idString(m.itemId)) return `markers[${i}] needs mapId and itemId`
    if (!isFiniteNumber(m.x) || !isFiniteNumber(m.y)) return `markers[${i}] needs numeric x/y`
    if (!isFiniteNumber(m.quantity) || m.quantity < 0) return `markers[${i}].quantity must be a number >= 0`
    if (!optString(m.name) || !optString(m.note) || !optString(m.gameId)) return `markers[${i}] name/note/gameId must be strings`
    if (m.lootedAt !== undefined && m.lootedAt !== null && !isFiniteNumber(m.lootedAt)) return `markers[${i}].lootedAt must be a number or null`
    markerIds.add(m.id)
  }

  const stashIds = new Set<string>()
  for (const [i, s] of ((raw.stashedItems ?? []) as unknown[]).entries()) {
    if (!isObject(s)) return `stashedItems[${i}] must be an object`
    if (!idString(s.id)) return `stashedItems[${i}].id is missing`
    if (stashIds.has(s.id)) return `stashedItems[${i}].id is duplicated`
    if (!idString(s.runId) || !runIds.has(s.runId)) return `stashedItems[${i}].runId does not match a run`
    if (!idString(s.poiId) || !idString(s.itemId)) return `stashedItems[${i}] needs poiId and itemId`
    if (!isFiniteNumber(s.quantity) || s.quantity < 0) return `stashedItems[${i}].quantity must be a number >= 0`
    stashIds.add(s.id)
  }

  const pinIds = new Set<string>()
  for (const [i, p] of ((raw.poiPins ?? []) as unknown[]).entries()) {
    if (!isObject(p)) return `poiPins[${i}] must be an object`
    if (!idString(p.poiId)) return `poiPins[${i}].poiId is missing`
    if (pinIds.has(p.poiId)) return `poiPins[${i}].poiId is duplicated`
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return `poiPins[${i}] needs numeric x/y`
    pinIds.add(p.poiId)
  }

  for (const k of ['enabledPOIs', 'recentMapIds'] as const) {
    if (((raw[k] ?? []) as unknown[]).some((v) => typeof v !== 'string')) return `${k} must contain strings`
  }
  return null
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
const asLoose = (v: object) => v as unknown as Loose

interface MergeResult<T> {
  records: T[]
  /** Local ids that were renamed because the remote side added a different record with the same id */
  renamed: Map<string, string>
}

/**
 * Merge records keyed by id. A side "changed" a record when it differs from base.
 * - Both changed → field-level merge, local wins per conflicting field.
 * - Deleted on one side but edited on the other → the edit survives (never lose work).
 * - Both sides added *different* records with the same id → keep both; the local
 *   copy gets a fresh id (only when `rekey` is given; otherwise local wins).
 */
function mergeRecords<T extends object>(
  base: T[], local: T[], remote: T[], key: (t: T) => string, rekey?: (t: T) => T,
): MergeResult<T> {
  const b = new Map(base.map((t) => [key(t), t]))
  const l = new Map(local.map((t) => [key(t), t]))
  const r = new Map(remote.map((t) => [key(t), t]))
  const out: T[] = []
  const renamed = new Map<string, string>()

  for (const [id, rv] of r) {
    const bv = b.get(id)
    const lv = l.get(id)
    if (!lv) {
      // Local deleted it: drop only if remote didn't change it since base
      if (!(bv && same(rv, bv))) out.push(rv)
      continue
    }
    if (same(lv, rv)) {
      out.push(lv)
    } else if (!bv) {
      if (rekey) {
        const fresh = rekey(lv)
        renamed.set(id, key(fresh))
        out.push(rv, fresh)
      } else {
        out.push(lv)
      }
    } else if (same(lv, bv)) {
      out.push(rv)
    } else if (same(rv, bv)) {
      out.push(lv)
    } else {
      const merged: Loose = { ...asLoose(rv) }
      const lr = asLoose(lv)
      const br = asLoose(bv)
      for (const f of Object.keys(lr)) {
        if (!same(lr[f], br[f])) merged[f] = lr[f]
      }
      out.push(merged as T)
    }
  }
  for (const [id, lv] of l) {
    if (r.has(id)) continue
    const bv = b.get(id)
    // Remote deleted it: drop only if local didn't change it since base
    if (!(bv && same(lv, bv))) out.push(lv)
  }
  return { records: out, renamed }
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
  const runMerge = mergeRecords(base.runs, local.runs, remote.runs, (r) => r.id, (r) => ({ ...r, id: createId('run') }))

  // A run re-id'd on collision takes this device's children (and selection) with it
  const remap = <T extends { runId: string }>(list: T[]) =>
    list.map((c) => (runMerge.renamed.has(c.runId) ? { ...c, runId: runMerge.renamed.get(c.runId)! } : c))
  const localMarkers = remap(local.markers)
  const localStashes = remap(local.stashedItems)
  const localRunId = local.currentRunId && runMerge.renamed.has(local.currentRunId)
    ? runMerge.renamed.get(local.currentRunId)!
    : local.currentRunId

  const markers = mergeRecords(base.markers, localMarkers, remote.markers, (m) => m.id, (m) => ({ ...m, id: createId('marker') })).records
  const stashedItems = mergeRecords(base.stashedItems, localStashes, remote.stashedItems, (s) => s.id, (s) => ({ ...s, id: createId('stash') })).records

  // A run deleted on one side while the other side added or edited its loot/stashes
  // comes back: losing the new work is worse than an unexpected run reappearing.
  const runs = runMerge.records
  const runIds = new Set(runs.map((r) => r.id))
  const baseMarkers = new Map(base.markers.map((m) => [m.id, m]))
  const baseStashes = new Map(base.stashedItems.map((s) => [s.id, s]))
  const knownRuns = new Map([...base.runs, ...remote.runs, ...local.runs].map((r) => [r.id, r]))
  const changedSinceBase = (child: { id: string }, baseChild: { id: string } | undefined) => !baseChild || !same(child, baseChild)
  for (const child of [...markers.map((m) => [m, baseMarkers.get(m.id)] as const), ...stashedItems.map((s) => [s, baseStashes.get(s.id)] as const)]) {
    const [c, bc] = child
    if (runIds.has(c.runId) || !changedSinceBase(c, bc)) continue
    const run = knownRuns.get(c.runId)
    if (run) {
      runs.push(run)
      runIds.add(run.id)
    }
  }

  const merged: AppData = {
    runs,
    markers: markers.filter((m) => runIds.has(m.runId)),
    stashedItems: stashedItems.filter((s) => runIds.has(s.runId)),
    poiPins: mergeRecords(base.poiPins, local.poiPins, remote.poiPins, (p) => p.poiId).records,
    enabledPOIs: mergeSet(base.enabledPOIs, local.enabledPOIs, remote.enabledPOIs),
    recentMapIds: mergeSet(base.recentMapIds, local.recentMapIds, remote.recentMapIds).slice(0, MAX_RECENT_MAPS),
    currentRunId: mergeScalar(base.currentRunId, localRunId, remote.currentRunId),
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
