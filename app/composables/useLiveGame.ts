import { computed, ref, shallowRef, watch } from 'vue'
import { getVariantKey } from '~/types'
import { planMark, resolveLivePosition, type LiveMarkEvent, type LiveState } from '#shared/utils/live'
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
/** Event ids this browser already turned into markers, shared by its tabs. */
const HANDLED_KEY = 'tld-buddy-handled-marks'
const MAX_HANDLED = 200

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

function readHandled(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(HANDLED_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

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
  watch(auth.state, (s) => {
    if (s === 'signed-in') connect()
    else {
      disconnect()
      state.value = null
      pendingMarks.value = []
    }
  }, { immediate: true })
  setInterval(() => (now.value = Date.now()), 1000)

  const game = useGameData()
  const statics = useStaticData()
  const addUi = useAddUi()

  // Place marks once the run's data and the static data are loaded
  watch([pendingMarks, game.apiSynced, game.currentRun, statics.ready], () => {
    const run = game.currentRun.value
    if (!pendingMarks.value.length || !game.apiSynced.value || !statics.ready.value || !run) return
    const batch = pendingMarks.value
    pendingMarks.value = []
    void withMarkLock(() => {
      const handled = readHandled()
      const variant = getVariantKey(run.difficulty)
      const done: string[] = []
      const added: string[] = []
      let unplaced = 0
      for (const event of batch) {
        done.push(event.id)
        if (handled.includes(event.id)) continue
        const plan = planMark(event, {
          scenes: statics.gameScenes.value,
          calibration: statics.calibration.value,
          variant,
          imageFor: (mapId) => statics.getMap(mapId)?.[variant],
          items: statics.items.value,
        })
        handled.push(event.id)
        if (!plan) {
          unplaced++
          continue
        }
        // Another browser may have added it already and synced it here
        if (game.markers.value.some((m) => m.id === plan.id)) continue
        game.addMarker({ ...plan, runId: run.id })
        added.push(plan.quantity > 1 ? `${plan.name} ×${plan.quantity}` : plan.name)
      }
      localStorage.setItem(HANDLED_KEY, JSON.stringify(handled.slice(-MAX_HANDLED)))
      ack(done)
      if (added.length) addUi.announce(`Marked from the game: ${added.join(', ')}`)
      else if (unplaced) addUi.announce('A mark from the game had no map position (region not calibrated yet)')
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
