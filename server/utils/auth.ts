import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getAppPassword, getCookieSecure, getSessionSecretOverride } from './config'
import { getRedis } from './redis'

export const SESSION_COOKIE = 'tld-buddy-session'
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days

const SECRET_KEY = 'auth:session-secret'
let cachedSecret: string | null = null

/**
 * Random signing secret, created once and kept in Redis so sessions survive restarts.
 * Unlike the old password-derived token, a stolen cookie reveals nothing about the
 * password, and `DEL auth:session-secret` signs every device out.
 */
async function getSessionSecret(): Promise<string> {
  const override = getSessionSecretOverride()
  if (override) return override
  if (cachedSecret) return cachedSecret
  const redis = await getRedis()
  await redis.set(SECRET_KEY, crypto.randomBytes(32).toString('hex'), { NX: true })
  const secret = await redis.get(SECRET_KEY)
  if (!secret) throw new Error('Session secret unavailable')
  cachedSecret = secret
  return secret
}

/** Bind sessions to the current password, so changing APP_PASSWORD revokes them. */
function passwordFingerprint(): string {
  return crypto.createHash('sha256').update(`tld-buddy:${getAppPassword()}`).digest('hex')
}

function sign(secret: string, issuedAt: string): string {
  return crypto.createHmac('sha256', secret).update(`${issuedAt}:${passwordFingerprint()}`).digest('hex')
}

export async function createSessionToken(): Promise<string> {
  if (!getAppPassword()) throw new Error('APP_PASSWORD not set')
  const issuedAt = String(Date.now())
  return `${issuedAt}.${sign(await getSessionSecret(), issuedAt)}`
}

export async function validateSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !getAppPassword()) return false
  const [issuedAt, signature] = token.split('.')
  if (!issuedAt || !signature || !/^\d+$/.test(issuedAt)) return false
  if (Date.now() - Number(issuedAt) > SESSION_MAX_AGE_S * 1000) return false
  // Throws when the secret cannot be read (Redis down); callers map that to 503, not 401
  const expected = Buffer.from(sign(await getSessionSecret(), issuedAt), 'hex')
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
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
const MAX_FAILURES = 10
const failures = new Map<string, { count: number; since: number }>()

/**
 * Client key for throttling. Behind Cloudflare the tunnel is the socket peer,
 * so prefer the address Cloudflare reports; direct LAN access uses the socket.
 */
export function clientKey(event: H3Event): string {
  return getHeader(event, 'cf-connecting-ip') || getRequestIP(event) || 'unknown'
}

export function isLoginLocked(key: string): boolean {
  const entry = failures.get(key)
  if (!entry) return false
  if (Date.now() - entry.since > WINDOW_MS) {
    failures.delete(key)
    return false
  }
  return entry.count >= MAX_FAILURES
}

export function recordLoginFailure(key: string) {
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || now - entry.since > WINDOW_MS) failures.set(key, { count: 1, since: now })
  else entry.count++
  if (failures.size > 1000) {
    for (const [k, v] of failures) if (now - v.since > WINDOW_MS) failures.delete(k)
  }
}

export function clearLoginFailures(key: string) {
  failures.delete(key)
}
