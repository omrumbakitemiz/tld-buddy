import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getAppPassword, getCookieSecure, getSessionSecretOverride } from './config'
import { withStorage } from './redis'

export const SESSION_COOKIE = 'tld-buddy-session'
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

const SECRET_KEY = 'auth:session-secret'
const SESSION_KEY = (sid: string) => `auth:session:${sid}`
/** Re-read the signing secret from Redis this often, so rotating it takes effect everywhere. */
const SECRET_REFRESH_MS = 60_000

let cachedSecret: { value: string; at: number } | null = null

/**
 * Random signing secret, created once and kept in Redis. A stolen cookie reveals nothing
 * about the password, and `DEL auth:session-secret` invalidates every token (within a minute).
 */
async function getSessionSecret(): Promise<string> {
  const override = getSessionSecretOverride()
  if (override) return override
  if (cachedSecret && Date.now() - cachedSecret.at < SECRET_REFRESH_MS) return cachedSecret.value
  const secret = await withStorage(async (redis) => {
    await redis.set(SECRET_KEY, crypto.randomBytes(32).toString('hex'), { NX: true })
    return redis.get(SECRET_KEY)
  })
  if (!secret) throw new Error('Session secret unavailable')
  cachedSecret = { value: secret, at: Date.now() }
  return secret
}

/** Bind sessions to the current password, so changing APP_PASSWORD revokes them. */
function passwordFingerprint(): string {
  return crypto.createHash('sha256').update(`tld-buddy:${getAppPassword()}`).digest('hex')
}

function sign(secret: string, sid: string): string {
  return crypto.createHmac('sha256', secret).update(`${sid}:${passwordFingerprint()}`).digest('hex')
}

/**
 * Token = `<session id>.<signature>`. The session id is also stored in Redis with a TTL,
 * so a session is valid only while its key exists: logout deletes it server-side.
 */
export async function createSessionToken(): Promise<string> {
  if (!getAppPassword()) throw new Error('APP_PASSWORD not set')
  const sid = crypto.randomBytes(16).toString('hex')
  const token = `${sid}.${sign(await getSessionSecret(), sid)}`
  await withStorage((redis) => redis.set(SESSION_KEY(sid), String(Date.now()), { EX: SESSION_MAX_AGE_S }))
  return token
}

/** Session id of a correctly signed token, or null. Throws when storage is down (callers answer 503). */
async function verifiedSessionId(token: string | undefined): Promise<string | null> {
  if (!token || !getAppPassword()) return null
  const [sid, signature] = token.split('.')
  if (!sid || !signature || !/^[0-9a-f]{32}$/.test(sid) || !/^[0-9a-f]{64}$/.test(signature)) return null
  const expected = Buffer.from(sign(await getSessionSecret(), sid), 'hex')
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? sid : null
}

export async function validateSessionToken(token: string | undefined): Promise<boolean> {
  const sid = await verifiedSessionId(token)
  if (!sid) return false
  return (await withStorage((redis) => redis.exists(SESSION_KEY(sid)))) === 1
}

/** Server-side logout: the token stops working everywhere, not just in this browser. */
export async function revokeSession(token: string | undefined): Promise<void> {
  const sid = await verifiedSessionId(token)
  if (sid) await withStorage((redis) => redis.del(SESSION_KEY(sid)))
}

/** Constant-time password comparison (hashing first equalises lengths). */
export function passwordMatches(submitted: string): boolean {
  const expected = getAppPassword()
  if (!expected || !submitted) return false
  const a = crypto.createHash('sha256').update(submitted).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  return validateSessionToken(getCookie(event, SESSION_COOKIE))
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/', secure: getCookieSecure() })
}

// ── Login throttling ────────────────────────────────────────────────────────

const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILURES_PER_CLIENT = 10
/** Across all clients, so rotating addresses can't brute-force either. */
const MAX_FAILURES_GLOBAL = 50
const MAX_TRACKED_CLIENTS = 1000

const failures = new Map<string, { count: number; since: number }>()
let global = { count: 0, since: 0 }

/**
 * Throttle key: the TCP peer address. Headers like CF-Connecting-IP are not trusted,
 * because port 4000 is reachable without Cloudflare and anyone could set them. Behind
 * the tunnel or tsdproxy all traffic shares one peer, so the limit is effectively global there.
 */
export function clientKey(event: H3Event): string {
  return event.node.req.socket?.remoteAddress || 'unknown'
}

function prune(now: number) {
  for (const [k, v] of failures) if (now - v.since > WINDOW_MS) failures.delete(k)
  // Still full: forget the oldest entries (Map keeps insertion order)
  while (failures.size >= MAX_TRACKED_CLIENTS) failures.delete(failures.keys().next().value!)
}

export function isLoginLocked(key: string): boolean {
  const now = Date.now()
  if (now - global.since > WINDOW_MS) global = { count: 0, since: now }
  if (global.count >= MAX_FAILURES_GLOBAL) return true
  const entry = failures.get(key)
  if (!entry) return false
  if (now - entry.since > WINDOW_MS) {
    failures.delete(key)
    return false
  }
  return entry.count >= MAX_FAILURES_PER_CLIENT
}

export function recordLoginFailure(key: string) {
  const now = Date.now()
  if (now - global.since > WINDOW_MS) global = { count: 0, since: now }
  global.count++
  const entry = failures.get(key)
  if (entry && now - entry.since <= WINDOW_MS) {
    entry.count++
    return
  }
  failures.delete(key)
  if (failures.size >= MAX_TRACKED_CLIENTS) prune(now)
  failures.set(key, { count: 1, since: now })
}

export function clearLoginFailures(key: string) {
  failures.delete(key)
}
