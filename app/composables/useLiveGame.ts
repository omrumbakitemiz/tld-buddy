import { computed, ref, shallowRef, watch } from 'vue'
import { getVariantKey, type Run } from '~/types'
import {
  planItemsEvent, planMark, resolveLivePosition, sceneLabel, type LiveGameEvent, type LiveSave, type LiveState, type LiveWorld, type TrailPoint, recentTrail,
} from '#shared/utils/live'
import { useAddUi } from './useAddUi'
import { useAuth } from './useAuth'
import { useGameData } from './useGameData'
import { useStaticData } from './useStaticData'

/**
 * Live player position from the TLD game mod, streamed by the server (SSE).
 * The mod sends about once a second; without an update for STALE_MS the game counts as
 * not running (closed, main menu, or the PC is off) and the marker hides.
 *
 * Game events from the mod update the current run: "mark here" adds a marker, a pickup loots
 * the nearest marker for that item, a drop adds a stash. The server holds them until a
 * browser acks, so what happened while no tab was open arrives when one connects.
 */

const STALE_MS = 10_000
const RECONNECT_MS = 10_000
const HIDDEN_GRACE_MS = 5_000
/** Event ids this browser already applied, shared by its tabs. */
const HANDLED_KEY = 'tld-buddy-handled-marks'
const MAX_HANDLED = 1000
/**
 * Events that had no map position yet (region not calibrated). Kept in this browser and applied
 * as soon as a deploy brings that region's calibration, so nothing is lost.
 */
const UNPLACED_KEY = 'tld-buddy-unplaced-marks'
const MAX_UNPLACED = 300

const state = shallowRef<LiveState | null>(null)
/** Local time the state was sent by the mod, derived from the server's age so clocks needn't agree. */
const receivedAt = ref(0)
const now = ref(Date.now())
const connected = ref(false)
/** Game events received but not applied yet (data still loading, or no run selected). */
const pendingEvents = shallowRef<LiveGameEvent[]>([])

/** Breadcrumb trail of the current run's game save: loaded from the server, then extended live. */
const trail = shallowRef<{ save: string | null; points: TrailPoint[] }>({ save: null, points: [] })

/**
 * The server pings every 15 s. Nothing for this long means the connection died without telling
 * (laptop sleep, Wi-Fi change): Chrome still counts it as open, so drop it and connect again.
 */
const SILENT_MS = 45_000
const STREAM_LOCK = 'tld-buddy-live-stream'

type LiveMessage = { state: LiveState | null; ageMs: number | null }
/** What the tab holding the stream passes on to the browser's other tabs. */
type Relay =
  | { kind: 'state'; message: LiveMessage }
  | { kind: 'game'; event: LiveGameEvent }
  | { kind: 'trail'; save: string; point: TrailPoint }
  | { kind: 'connected'; value: boolean }
  | { kind: 'hello' }

let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let lastMessageAt = 0
let channel: BroadcastChannel | null = null
let started = false

function onState(message: LiveMessage) {
  state.value = message.state
  receivedAt.value = message.ageMs == null ? 0 : Date.now() - message.ageMs
}

function onGame(event: LiveGameEvent) {
  if (!pendingEvents.value.some((m) => m.id === event.id)) pendingEvents.value = [...pendingEvents.value, event]
}

function onTrail(save: string, point: TrailPoint) {
  if (save === trail.value.save) trail.value = { save, points: [...trail.value.points, point] }
}

function setConnected(value: boolean) {
  connected.value = value
  channel?.postMessage({ kind: 'connected', value } satisfies Relay)
}

/** Opens the stream in this tab, and relays what it receives to the others. */
function connect() {
  disconnect()
  lastMessageAt = Date.now()
  source = new EventSource('/api/live/v1/stream')
  const on = (name: string, fn: (data: string) => void) =>
    source!.addEventListener(name, (e) => {
      lastMessageAt = Date.now()
      fn((e as MessageEvent<string>).data)
    })
  on('open', () => setConnected(true))
  on('ping', () => {})
  on('state', (data) => {
    const message = JSON.parse(data) as LiveMessage
    onState(message)
    channel?.postMessage({ kind: 'state', message } satisfies Relay)
  })
  on('game', (data) => {
    const event = JSON.parse(data) as LiveGameEvent
    onGame(event)
    channel?.postMessage({ kind: 'game', event } satisfies Relay)
  })
  on('trail', (data) => {
    const { save, point } = JSON.parse(data) as { save: string; point: TrailPoint }
    onTrail(save, point)
    channel?.postMessage({ kind: 'trail', save, point } satisfies Relay)
  })
  source.addEventListener('error', () => {
    setConnected(false)
    // EventSource retries on network errors by itself, but gives up on HTTP errors (401, 503)
    if (source?.readyState === EventSource.CLOSED) {
      reconnectTimer = setTimeout(connect, RECONNECT_MS)
    }
  })
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (source) setConnected(false)
  source?.close()
  source = null
}

/** Messages from the tab holding the stream (or, for "hello", from a tab that just opened). */
function onRelay(relay: Relay) {
  if (relay.kind === 'hello') {
    // Catch the new tab up; the server only sends the current state on connect
    if (source && state.value) {
      channel?.postMessage({ kind: 'state', message: { state: state.value, ageMs: Date.now() - receivedAt.value } } satisfies Relay)
    }
    if (source) channel?.postMessage({ kind: 'connected', value: connected.value } satisfies Relay)
  } else if (relay.kind === 'state') onState(relay.message)
  else if (relay.kind === 'game') onGame(relay.event)
  else if (relay.kind === 'trail') onTrail(relay.save, relay.point)
  else if (!source) connected.value = relay.value
}

/**
 * Takes the stream when no other tab of this browser has it: one tab streams for all of them,
 * so any number of tabs and windows use a single connection. Returns a function that stops
 * streaming (or stops waiting to); another waiting tab then takes over.
 */
function leadStream(): () => void {
  if (!navigator.locks) {
    connect()
    return disconnect
  }
  const abort = new AbortController()
  let release: (() => void) | null = null
  navigator.locks.request(STREAM_LOCK, { signal: abort.signal }, () => new Promise<void>((resolve) => {
    connect()
    release = () => {
      disconnect()
      resolve()
    }
  })).catch(() => {}) // aborted while waiting
  return () => {
    abort.abort()
    release?.()
  }
}

function readList<T>(key: string, keep: (x: unknown) => x is T): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(list) ? list.filter(keep) : []
  } catch {
    return []
  }
}

const readHandled = () => readList(HANDLED_KEY, (x): x is string => typeof x === 'string')
const readUnplaced = () => readList(UNPLACED_KEY, (x): x is LiveGameEvent => !!x && typeof x === 'object' && typeof (x as LiveGameEvent).id === 'string')

function ack(ids: string[]) {
  if (!ids.length) return
  // Best effort: an unacked mark is sent again on reconnect, and then skipped as handled
  fetch('/api/live/v1/events/ack', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) })
    .catch(() => {})
}

/** One tab at a time, so two open tabs don't both add the same mark. */
async function withMarkLock(fn: () => void) {
  if (navigator.locks) await navigator.locks.request('tld-buddy-live-marks', fn)
  else fn()
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const auth = useAuth()
  // Browsers allow only 6 connections per site over plain http, shared by all tabs, and each
  // stream holds one for good: once they are used up, new pages wait forever. So one visible
  // tab streams and relays to the others (BroadcastChannel). When it is hidden or closed,
  // another visible tab takes over; with none visible, nothing streams, and the next tab to
  // show catches up (the server sends the current state and unacked events on connect).
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('tld-buddy-live')
    channel.onmessage = (e: MessageEvent<Relay>) => onRelay(e.data)
    channel.postMessage({ kind: 'hello' } satisfies Relay)
  }
  const visible = ref(document.visibilityState === 'visible')
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  document.addEventListener('visibilitychange', () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
    if (document.visibilityState === 'visible') visible.value = true
    else hideTimer = setTimeout(() => (visible.value = false), HIDDEN_GRACE_MS)
  })
  let stopLeading: (() => void) | null = null
  watch([auth.state, visible], ([s, v]) => {
    const want = s === 'signed-in' && v
    if (want && !stopLeading) stopLeading = leadStream()
    if (!want && stopLeading) {
      stopLeading()
      stopLeading = null
    }
    if (s !== 'signed-in') {
      state.value = null
      pendingEvents.value = []
    }
  }, { immediate: true })
  setInterval(() => {
    now.value = Date.now()
    // A stream that went silent is dead even if the browser still thinks it is open
    if (source && now.value - lastMessageAt > SILENT_MS) connect()
  }, 1000)

  const game = useGameData()
  const statics = useStaticData()
  const addUi = useAddUi()

  /** "Winding River & Carter Hydro Dam", or the building/scene name when it isn't on a map. */
  function placeName(event: LiveGameEvent): string {
    for (const s of event.scenes) {
      const known = statics.gameScenes.value.find((g) => g.scene === s.scene)
      if (known) return statics.getMap(known.mapId)?.name ?? sceneLabel(s.scene)
    }
    return sceneLabel(event.scenes[0]?.scene ?? 'the game')
  }

  // Apply new events, and retry kept ones, once the run's data and the static data are loaded
  const runLinks = () => game.runs.value.map((r) => `${r.id}=${r.gameSave ?? ''}`).join()
  watch([pendingEvents, game.apiSynced, game.currentRun, runLinks, statics.ready], () => {
    const current = game.currentRun.value
    if (!game.apiSynced.value || !statics.ready.value || !current) return
    const fresh = pendingEvents.value
    if (!fresh.length && !readUnplaced().length) return
    pendingEvents.value = []
    void withMarkLock(() => {
      const handled = readHandled()
      const kept = readUnplaced()
      const freshIds = new Set(fresh.map((e) => e.id))
      const batch = [...kept.filter((e) => !freshIds.has(e.id)), ...fresh]
      /** The run linked to the event's save, else the current run unless that one tracks another save. */
      const runFor = (event: LiveGameEvent) => {
        if (!event.save) return current
        return game.runs.value.find((r) => r.gameSave === event.save) ?? (current.gameSave ? null : current)
      }
      const placingFor = (run: Run) => {
        const variant = getVariantKey(run.difficulty)
        return {
          scenes: statics.gameScenes.value,
          calibration: statics.calibration.value,
          variant,
          imageFor: (mapId: string) => statics.getMap(mapId)?.[variant],
          items: statics.items.value,
          markers: game.markers.value.filter((m) => m.runId === run.id),
        }
      }
      const counted = (name: string, n: number) => (n > 1 ? `${name} ×${n}` : name)
      const added: string[] = []
      const already: string[] = []
      const moved: string[] = []
      const looted: string[] = []
      const dropped: string[] = []
      const stored: string[] = []
      const stillUnplaced: LiveGameEvent[] = []
      const newlyUnplaced: LiveGameEvent[] = []
      const keep = (event: LiveGameEvent) => {
        stillUnplaced.push(event)
        // Pickups and drops are kept quietly: only a mark is worth a toast
        if (event.type === 'mark' && !kept.some((k) => k.id === event.id)) newlyUnplaced.push(event)
      }
      for (const event of batch) {
        if (handled.includes(event.id)) continue
        const run = runFor(event)
        // From a save no run is linked to yet: kept until the player links or starts one
        if (!run) {
          stillUnplaced.push(event)
          continue
        }
        const placing = placingFor(run)
        if (event.type === 'mark') {
          const plan = planMark(event, placing)
          if (!plan) {
            keep(event)
            continue
          }
          handled.push(event.id)
          // Another browser may have added it already and synced it here
          if (game.markers.value.some((m) => m.id === plan.id)) continue
          // The mark key pressed again on an item that already has a marker
          if (plan.repeatOf && plan.moved) {
            // Position only: the note may hold the player's own words
            game.updateMarker(plan.repeatOf, { x: plan.x, y: plan.y })
            moved.push(plan.name)
            continue
          }
          if (plan.repeatOf) {
            if (plan.adoptId) game.updateMarker(plan.repeatOf, { gameId: plan.gameId })
            already.push(plan.name)
            continue
          }
          game.addMarker({ ...plan, runId: run.id })
          added.push(counted(plan.name, plan.quantity))
          continue
        }
        const changes = planItemsEvent(event, placing)
        if (!changes) {
          keep(event)
          continue
        }
        handled.push(event.id)
        // Items put into a container are "stored", on the ground "dropped" (the marker notes say the same)
        const putDown = event.container ? stored : dropped
        for (const c of changes) {
          if (c.kind === 'add') {
            if (game.markers.value.some((m) => m.id === c.marker.id)) continue
            game.addMarker({ ...c.marker, runId: run.id })
            putDown.push(counted(c.marker.name, c.marker.quantity))
          } else if (c.kind === 'quantity') {
            game.updateMarker(c.markerId, { quantity: c.quantity })
            ;(c.by > 0 ? putDown : looted).push(counted(c.name, Math.abs(c.by)))
          } else {
            game.setLooted(c.markerId, true)
            looted.push(c.name)
          }
        }
      }
      localStorage.setItem(HANDLED_KEY, JSON.stringify(handled.slice(-MAX_HANDLED)))
      localStorage.setItem(UNPLACED_KEY, JSON.stringify(stillUnplaced.slice(-MAX_UNPLACED)))
      // Every fresh event is now applied or kept in this browser: the server can drop it
      ack(fresh.map((e) => e.id))
      // One toast slot: say everything in one message
      const parts: string[] = []
      if (added.length) parts.push(`Marked from the game: ${added.join(', ')}`)
      if (already.length) parts.push(`Already on the map: ${[...new Set(already)].join(', ')}`)
      if (moved.length) parts.push(`Moved: ${[...new Set(moved)].join(', ')}`)
      if (looted.length) parts.push(`Looted: ${looted.join(', ')}`)
      if (dropped.length) parts.push(`Dropped: ${dropped.join(', ')}`)
      if (stored.length) parts.push(`Stored: ${stored.join(', ')}`)
      if (newlyUnplaced.length) {
        const where = [...new Set(newlyUnplaced.map(placeName))].join(', ')
        parts.push(`Kept ${newlyUnplaced.length === 1 ? 'a mark' : `${newlyUnplaced.length} marks`} from ${where}: shown once that map is calibrated`)
      }
      if (parts.length) addUi.announce(parts.join('. '))
    })
  })

  // Load the trail of the current run's save; again after a reconnect, for points missed meanwhile
  let trailRequest = 0
  watch([() => game.currentRun.value?.gameSave ?? null, connected], async ([save, isConnected]) => {
    const request = ++trailRequest
    if (!save) {
      trail.value = { save: null, points: [] }
      return
    }
    if (trail.value.save !== save) trail.value = { save, points: [] }
    if (!isConnected) return
    try {
      const res = await fetch(`/api/live/v1/trail?save=${encodeURIComponent(save)}`)
      if (!res.ok || request !== trailRequest) return
      const { points } = (await res.json()) as { points: TrailPoint[] }
      // Points streamed in while the request ran come after the stored ones
      const lastStored = points.at(-1)?.t ?? 0
      trail.value = { save, points: [...points, ...trail.value.points.filter((p) => p.t > lastStored)] }
    } catch {
      // Keep what we have; the next reconnect tries again
    }
  }, { immediate: true })

  // Open the run of the save being played. Only when the game starts reporting a save (load, or
  // another save), so picking another run by hand while playing is not undone every second.
  let followedSave: string | null = null
  watch([() => state.value?.save?.id ?? null, game.apiSynced], ([saveId, synced]) => {
    if (!saveId || !synced || saveId === followedSave) return
    followedSave = saveId
    const linked = game.runs.value.find((r) => r.gameSave === saveId)
    if (!linked || linked.id === game.currentRun.value?.id) return
    game.setCurrentRun(linked.id)
    addUi.announce(`Switched to ${linked.name}: the run of the save you're playing`)
  })
}

/** Drops game events kept for maps not calibrated yet, so they don't come back after a reset. */
export function forgetKeptGameEvents() {
  localStorage.removeItem(UNPLACED_KEY)
}

/** Deletes a save's breadcrumb trail on the server (and here). */
export async function clearTrail(save: string) {
  if (trail.value.save === save) trail.value = { save, points: [] }
  await fetch(`/api/live/v1/trail?save=${encodeURIComponent(save)}`, { method: 'DELETE' }).catch(() => {})
}

export function useLiveGame() {
  start()
  const { currentRun } = useGameData()
  const { gameScenes, calibration, getMap } = useStaticData()

  /** The game is running and has reported recently. */
  const online = computed(() => !!state.value && now.value - receivedAt.value < STALE_MS)

  const position = computed(() => {
    if (!online.value) return null
    const variant = currentRun.value ? getVariantKey(currentRun.value.difficulty) : 'default'
    return resolveLivePosition(state.value, gameScenes.value, calibration.value, variant, (mapId) => getMap(mapId)?.[variant])
  })

  /** Scene the player is in right now (also unmapped interiors), for status text. */
  const currentScene = computed(() => (online.value ? state.value?.scenes[0]?.scene ?? null : null))

  /** Save being played, and its time, weather and condition (null when the game is not running). */
  const save = computed<LiveSave | null>(() => (online.value ? state.value?.save ?? null : null))
  const world = computed<LiveWorld | null>(() => (online.value ? state.value?.world ?? null : null))

  /** Trail points of the current run's save from the last TRAIL_DAYS in-game days, oldest first. */
  const trailPoints = computed(() => (trail.value.save && trail.value.save === currentRun.value?.gameSave ? recentTrail(trail.value.points) : []))

  return { connected, online, position, currentScene, save, world, trailPoints }
}
