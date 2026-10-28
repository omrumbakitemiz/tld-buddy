import { computed, ref, shallowRef, watch } from 'vue'
import { getVariantKey } from '~/types'
import { resolveLivePosition, type LiveState } from '#shared/utils/live'
import { useAuth } from './useAuth'
import { useGameData } from './useGameData'
import { useStaticData } from './useStaticData'

/**
 * Live player position from the TLD game mod, streamed by the server (SSE).
 * The mod sends about once a second; without an update for STALE_MS the game counts as
 * not running (closed, main menu, or the PC is off) and the marker hides.
 */

const STALE_MS = 10_000
const RECONNECT_MS = 10_000

const state = shallowRef<LiveState | null>(null)
/** Local time the state was sent by the mod, derived from the server's age so clocks needn't agree. */
const receivedAt = ref(0)
const now = ref(Date.now())
const connected = ref(false)

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

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const auth = useAuth()
  watch(auth.state, (s) => {
    if (s === 'signed-in') connect()
    else {
      disconnect()
      state.value = null
    }
  }, { immediate: true })
  setInterval(() => (now.value = Date.now()), 1000)
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
