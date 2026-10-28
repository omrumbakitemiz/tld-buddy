import { computed, ref, shallowRef, watch } from 'vue'
import { getVariantKey } from '~/types'
import { planMark, resolveLivePosition, sceneLabel, type LiveMarkEvent, type LiveState } from '#shared/utils/live'
import { useAddUi } from './useAddUi'
import { useAuth } from './useAuth'
import { useGameData } from './useGameData'
import { useStaticData } from './useStaticData'

/**
 * Live player position from the TLD game mod, streamed by the server (SSE).
 * The mod sends about once a second; without an update for STALE_MS the game counts as
 * not running (closed, main menu, or the PC is off) and the marker hides.
 *
 * "Mark here" events from the mod become markers in the current run. The server holds them
 * until a browser acks, so marks made while no tab was open arrive when one connects.
 */

const STALE_MS = 10_000
const RECONNECT_MS = 10_000
const HIDDEN_GRACE_MS = 5_000
/** Event ids this browser already turned into markers, shared by its tabs. */
const HANDLED_KEY = 'tld-buddy-handled-marks'
const MAX_HANDLED = 200
/**
 * Marks that had no map position yet (region not calibrated). Kept in this browser and placed
 * as soon as a deploy brings that region's calibration, so no mark is lost.
 */
const UNPLACED_KEY = 'tld-buddy-unplaced-marks'
const MAX_UNPLACED = 100

const state = shallowRef<LiveState | null>(null)
/** Local time the state was sent by the mod, derived from the server's age so clocks needn't agree. */
const receivedAt = ref(0)
const now = ref(Date.now())
const connected = ref(false)
/** Mark events received but not placed yet (data still loading, or no run selected). */
const pendingMarks = shallowRef<LiveMarkEvent[]>([])

let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function connect() {
  disconnect()
  source = new EventSource('/api/live/v1/stream')
  source.addEventListener('open', () => (connected.value = true))
  source.addEventListener('state', (e) => {
    const message = JSON.parse((e as MessageEvent<string>).data) as { state: LiveState | null; ageMs: number | null }
    state.value = message.state
    receivedAt.value = message.ageMs == null ? 0 : Date.now() - message.ageMs
  })
  source.addEventListener('mark', (e) => {
    const event = JSON.parse((e as MessageEvent<string>).data) as LiveMarkEvent
    if (!pendingMarks.value.some((m) => m.id === event.id)) pendingMarks.value = [...pendingMarks.value, event]
  })
  source.addEventListener('error', () => {
    connected.value = false
    // EventSource retries on network errors by itself, but gives up on HTTP errors (401, 503)
    if (source?.readyState === EventSource.CLOSED) {
      reconnectTimer = setTimeout(connect, RECONNECT_MS)
    }
  })
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  source?.close()
  source = null
  connected.value = false
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
const readUnplaced = () => readList(UNPLACED_KEY, (x): x is LiveMarkEvent => !!x && typeof x === 'object' && typeof (x as LiveMarkEvent).id === 'string')

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
  // stream holds one for good: with a few tabs open, new pages would wait forever. So only
  // visible tabs stream; a hidden tab lets go after a short grace and catches up on return
  // (the server sends the current state and unacked marks on connect).
  const visible = ref(document.visibilityState === 'visible')
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  document.addEventListener('visibilitychange', () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
    if (document.visibilityState === 'visible') visible.value = true
    else hideTimer = setTimeout(() => (visible.value = false), HIDDEN_GRACE_MS)
  })
  watch([auth.state, visible], ([s, v]) => {
    if (s !== 'signed-in') {
      disconnect()
      state.value = null
      pendingMarks.value = []
    } else if (v) {
      if (!source) connect()
    } else {
      disconnect()
    }
  }, { immediate: true })
  setInterval(() => (now.value = Date.now()), 1000)

  const game = useGameData()
  const statics = useStaticData()
  const addUi = useAddUi()

  /** "Winding River & Carter Hydro Dam", or the building/scene name when it isn't on a map. */
  function placeName(event: LiveMarkEvent): string {
    for (const s of event.scenes) {
      const known = statics.gameScenes.value.find((g) => g.scene === s.scene)
      if (known) return statics.getMap(known.mapId)?.name ?? sceneLabel(s.scene)
    }
    return sceneLabel(event.scenes[0]?.scene ?? 'the game')
  }

  // Place new marks, and retry kept ones, once the run's data and the static data are loaded
  watch([pendingMarks, game.apiSynced, game.currentRun, statics.ready], () => {
    const run = game.currentRun.value
    if (!game.apiSynced.value || !statics.ready.value || !run) return
    const fresh = pendingMarks.value
    if (!fresh.length && !readUnplaced().length) return
    pendingMarks.value = []
    void withMarkLock(() => {
      const handled = readHandled()
      const kept = readUnplaced()
      const freshIds = new Set(fresh.map((e) => e.id))
      const batch = [...kept.filter((e) => !freshIds.has(e.id)), ...fresh]
      const variant = getVariantKey(run.difficulty)
      const added: string[] = []
      const stillUnplaced: LiveMarkEvent[] = []
      const newlyUnplaced: LiveMarkEvent[] = []
      for (const event of batch) {
        if (handled.includes(event.id)) continue
        const plan = planMark(event, {
          scenes: statics.gameScenes.value,
          calibration: statics.calibration.value,
          variant,
          imageFor: (mapId) => statics.getMap(mapId)?.[variant],
          items: statics.items.value,
        })
        if (!plan) {
          stillUnplaced.push(event)
          if (!kept.some((k) => k.id === event.id)) newlyUnplaced.push(event)
          continue
        }
        handled.push(event.id)
        // Another browser may have added it already and synced it here
        if (game.markers.value.some((m) => m.id === plan.id)) continue
        game.addMarker({ ...plan, runId: run.id })
        added.push(plan.quantity > 1 ? `${plan.name} ×${plan.quantity}` : plan.name)
      }
      localStorage.setItem(HANDLED_KEY, JSON.stringify(handled.slice(-MAX_HANDLED)))
      localStorage.setItem(UNPLACED_KEY, JSON.stringify(stillUnplaced.slice(-MAX_UNPLACED)))
      // Every fresh mark is now either a marker or kept in this browser: the server can drop it
      ack(fresh.map((e) => e.id))
      // One toast slot: say both things in one message
      const parts: string[] = []
      if (added.length) parts.push(`Marked from the game: ${added.join(', ')}`)
      if (newlyUnplaced.length) {
        const where = [...new Set(newlyUnplaced.map(placeName))].join(', ')
        parts.push(`Kept ${newlyUnplaced.length === 1 ? 'a mark' : `${newlyUnplaced.length} marks`} from ${where}: shown once that map is calibrated`)
      }
      if (parts.length) addUi.announce(parts.join('. '))
    })
  })
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

  return { connected, online, position, currentScene }
}
