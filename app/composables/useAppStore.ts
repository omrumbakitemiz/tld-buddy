import { ref, readonly, computed } from 'vue'
import type { AppData } from '~/types'
import { createDefaultAppData, mergeAppData, normalizeAppData } from '#shared/utils/appData'

/**
 * Owns the user's data and keeps it in sync with the server.
 *
 * Model: a single JSON document with a server revision number.
 * - `appData` is the working copy every component reads and mutates.
 * - `base` is the last document both this device and the server agreed on.
 * - Saves send `X-Base-Rev`; if another device saved first the server answers 409
 *   with its document and we three-way merge (base, local, remote) and retry.
 * - Unsynced edits survive reloads: they live in localStorage together with `base`,
 *   and are merged into the server copy on the next successful load.
 * - Nothing is written to the server until one authenticated load succeeded, so a
 *   stale or empty local cache can never overwrite Redis.
 */

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'offline' | 'error'

const CACHE_KEY = 'tld-buddy-v1' // AppData only — same key and shape as before
const META_KEY = 'tld-buddy-sync-v1' // { base, baseRev, dirty }
const SAVE_DEBOUNCE_MS = 500
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]
const KEEPALIVE_LIMIT_BYTES = 60_000

interface SyncMeta {
  base: AppData | null
  baseRev: string | null
  dirty: boolean
}

const isClient = typeof window !== 'undefined'

const appData = ref<AppData>(createDefaultAppData())
const status = ref<SyncStatus>('idle')
const lastSavedAt = ref<number | null>(null)
const authExpired = ref(false)
/** True only after a successful authenticated /api/data load — blocks API saves until then. */
const apiSynced = ref(false)

let meta: SyncMeta = { base: null, baseRev: null, dirty: false }
let changeCounter = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
let inFlight: Promise<void> | null = null
let initialised = false

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// ── Local cache ─────────────────────────────────────────────────────────────

function readLocal() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) appData.value = normalizeAppData(JSON.parse(raw))
    const rawMeta = localStorage.getItem(META_KEY)
    if (rawMeta) {
      const parsed = JSON.parse(rawMeta) as Partial<SyncMeta>
      meta = {
        base: parsed.base ? normalizeAppData(parsed.base) : null,
        baseRev: parsed.baseRev ?? null,
        dirty: parsed.dirty === true,
      }
    }
  } catch {
    console.warn('Failed to read local cache')
  }
}

function writeLocal() {
  if (!isClient) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(appData.value))
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Storage full or unavailable — the server copy is still the source of truth
  }
}

function init() {
  if (initialised || !isClient) return
  initialised = true
  readLocal()

  // Flush pending edits when the tab is hidden or closed (debounce would otherwise drop them)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true)
    else if (apiSynced.value) void pull()
  })
  window.addEventListener('pagehide', () => flush(true))
  window.addEventListener('online', () => {
    if (meta.dirty) scheduleSave(0)
  })
}

// ── Server I/O ──────────────────────────────────────────────────────────────

/** Fetch the server copy and reconcile it with any unsynced local edits. */
async function pull(): Promise<boolean> {
  if (!isClient) return false
  if (inFlight) await inFlight
  if (status.value !== 'saving') status.value = apiSynced.value ? status.value : 'loading'
  try {
    const res = await fetch('/api/data', { cache: 'no-store' })
    if (res.status === 401) {
      authExpired.value = true
      apiSynced.value = false
      status.value = 'idle'
      return false
    }
    // Redis down / server error — keep local cache, do not mark synced (blocks PUT wipe)
    if (!res.ok) {
      status.value = 'offline'
      return false
    }
    const remote = normalizeAppData(await res.json())
    const rev = res.headers.get('X-Data-Rev')
    adoptRemote(remote, rev)
    apiSynced.value = true
    if (meta.dirty) scheduleSave(0)
    else status.value = 'saved'
    return true
  } catch {
    status.value = 'offline'
    return false
  }
}

/** Take a server document as the new base, keeping local edits made since the old base. */
function adoptRemote(remote: AppData, rev: string | null) {
  if (meta.dirty && meta.base) {
    appData.value = mergeAppData(meta.base, appData.value, remote)
    changeCounter++
  } else if (meta.dirty) {
    // Edits made before this device ever synced: keep them, but never drop server records
    appData.value = mergeAppData(createDefaultAppData(), appData.value, remote)
    changeCounter++
  } else {
    appData.value = remote
  }
  meta = { base: clone(remote), baseRev: rev, dirty: meta.dirty }
  writeLocal()
}

async function push(keepalive = false): Promise<void> {
  if (!apiSynced.value || !meta.dirty) return
  const snapshot = clone(appData.value)
  const version = changeCounter
  const body = JSON.stringify(snapshot)
  status.value = 'saving'

  let res: Response
  try {
    res = await fetch('/api/data', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(meta.baseRev ? { 'X-Base-Rev': meta.baseRev } : {}),
      },
      body,
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT_BYTES,
    })
  } catch {
    status.value = 'offline'
    scheduleRetry()
    return
  }

  if (res.status === 401) {
    authExpired.value = true
    apiSynced.value = false
    status.value = 'idle'
    return
  }

  if (res.status === 409) {
    const payload = await res.json().catch(() => null) as { rev?: string; data?: unknown } | null
    const remote = normalizeAppData(payload?.data ?? null)
    adoptRemote(remote, payload?.rev ?? res.headers.get('X-Data-Rev'))
    meta.dirty = true
    writeLocal()
    scheduleSave(0)
    return
  }

  if (!res.ok) {
    status.value = res.status >= 500 ? 'offline' : 'error'
    scheduleRetry()
    return
  }

  const result = await res.json().catch(() => ({})) as { rev?: string }
  retryAttempt = 0
  meta.base = snapshot
  meta.baseRev = result.rev ?? res.headers.get('X-Data-Rev') ?? meta.baseRev
  meta.dirty = changeCounter !== version
  writeLocal()
  lastSavedAt.value = Date.now()
  if (meta.dirty) scheduleSave(SAVE_DEBOUNCE_MS)
  else status.value = 'saved'
}

function runPush(keepalive = false) {
  if (inFlight) {
    // One request at a time; whatever changed meanwhile goes out right after
    inFlight.then(() => scheduleSave(0))
    return
  }
  inFlight = push(keepalive).finally(() => { inFlight = null })
}

function scheduleSave(delay = SAVE_DEBOUNCE_MS) {
  if (!isClient) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    runPush()
  }, delay)
}

function scheduleRetry() {
  if (retryTimer) return
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)]
  retryAttempt++
  retryTimer = setTimeout(() => {
    retryTimer = null
    runPush()
  }, delay)
}

function flush(keepalive = false) {
  if (!meta.dirty || !apiSynced.value) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  runPush(keepalive)
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Record a mutation of `appData`: cache locally right away, save to the server debounced. */
function commit() {
  changeCounter++
  meta.dirty = true
  writeLocal()
  if (apiSynced.value) scheduleSave()
}

/** Forget the session-bound sync state (logout). Local edits stay cached for the next login. */
function resetSession() {
  apiSynced.value = false
  status.value = 'idle'
}

if (isClient) init()

export function useAppStore() {
  init()
  return {
    appData,
    commit,
    pull,
    flush,
    resetSession,
    authExpired,
    apiSynced: readonly(apiSynced),
    syncStatus: readonly(status),
    lastSavedAt: readonly(lastSavedAt),
    hasUnsavedChanges: computed(() => status.value === 'saving' || status.value === 'offline' || status.value === 'error'),
  }
}
