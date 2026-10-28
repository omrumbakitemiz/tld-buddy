import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import type { LiveGameEvent, LiveState } from '#shared/utils/live'
import { getModToken } from './config'

/**
 * Latest state from the game mod, kept in memory only. It is a live view, not saved data:
 * a server restart just means "no position" until the mod's next update a second later.
 */
let latest: { state: LiveState; receivedAt: number } | null = null

/**
 * Game events (marks, pickups, drops) waiting for a browser to apply them to the markers.
 * A browser acks once it has; until then every newly connecting browser gets them, so what
 * happened in game while no tab was open still arrives. Bounded (pickups add up over a
 * session), and dropped after a day.
 */
const pending = new Map<string, LiveGameEvent>()
const MAX_PENDING = 300
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

/** What browsers receive on the stream. `ageMs` lets clients judge staleness without trusting clocks. */
export interface LiveMessage {
  state: LiveState | null
  ageMs: number | null
}

export type LiveBroadcast = { kind: 'state'; message: LiveMessage } | { kind: 'event'; event: LiveGameEvent }

const listeners = new Set<(broadcast: LiveBroadcast) => void>()

function broadcast(b: LiveBroadcast) {
  for (const listener of listeners) listener(b)
}

export function currentLiveMessage(): LiveMessage {
  return latest ? { state: latest.state, ageMs: Date.now() - latest.receivedAt } : { state: null, ageMs: null }
}

export function publishLiveState(state: LiveState) {
  latest = { state, receivedAt: Date.now() }
  broadcast({ kind: 'state', message: currentLiveMessage() })
}

function prunePending(now: number) {
  for (const [id, e] of pending) if (now - e.createdAt > PENDING_TTL_MS) pending.delete(id)
}

/** Stores and broadcasts a game event. Returns false for an id already seen (a retry from the mod). */
export function publishLiveEvent(event: LiveGameEvent): boolean {
  if (pending.has(event.id)) return false
  prunePending(event.createdAt)
  // Map keeps insertion order: drop the oldest when full
  while (pending.size >= MAX_PENDING) pending.delete(pending.keys().next().value!)
  pending.set(event.id, event)
  broadcast({ kind: 'event', event })
  return true
}

export function pendingLiveEvents(): LiveGameEvent[] {
  prunePending(Date.now())
  return [...pending.values()]
}

export function ackLiveEvents(ids: string[]) {
  for (const id of ids) pending.delete(id)
}

export function subscribeLive(listener: (broadcast: LiveBroadcast) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Constant-time check of `Authorization: Bearer <token>` against MOD_TOKEN. */
export function isModRequest(event: H3Event): boolean {
  const expected = getModToken()
  const header = getHeader(event, 'authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!expected || !given) return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}
