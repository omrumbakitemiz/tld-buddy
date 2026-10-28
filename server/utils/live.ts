import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import type { LiveState } from '#shared/utils/live'
import { getModToken } from './config'

/**
 * Latest state from the game mod, kept in memory only. It is a live view, not saved data:
 * a server restart just means "no position" until the mod's next update a second later.
 */
let latest: { state: LiveState; receivedAt: number } | null = null
const listeners = new Set<(message: LiveMessage) => void>()

/** What browsers receive on the stream. `ageMs` lets clients judge staleness without trusting clocks. */
export interface LiveMessage {
  state: LiveState | null
  ageMs: number | null
}

export function currentLiveMessage(): LiveMessage {
  return latest ? { state: latest.state, ageMs: Date.now() - latest.receivedAt } : { state: null, ageMs: null }
}

export function publishLiveState(state: LiveState) {
  latest = { state, receivedAt: Date.now() }
  const message = currentLiveMessage()
  for (const listener of listeners) listener(message)
}

export function subscribeLive(listener: (message: LiveMessage) => void): () => void {
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
