import crypto from 'node:crypto'

const TOKEN_PREFIX = 'tld-buddy:'

function getAppPassword(): string {
  const config = useRuntimeConfig()
  const password = config.appPassword
  if (!password) throw new Error('APP_PASSWORD not set')
  return password
}

/**
 * Create a signed session token from the app password.
 * Uses HMAC-SHA256 with the password itself as the key.
 */
export function createSessionToken(): string {
  const password = getAppPassword()
  const hmac = crypto.createHmac('sha256', password)
  hmac.update(TOKEN_PREFIX + password)
  return hmac.digest('hex')
}

/**
 * Validate a session token against the expected value.
 */
export function validateSessionToken(token: string): boolean {
  try {
    const expected = createSessionToken()
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}
