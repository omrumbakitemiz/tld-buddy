import { getRedis } from './redis'

/** Redis keys. `app-data` keeps the exact JSON shape older builds wrote and read. */
export const KEYS = {
  data: 'app-data',
  rev: 'app-data:rev',
  backups: 'app-data:backups',
  backupAt: 'app-data:backup-at',
} as const

const BACKUP_INTERVAL_MS = 10 * 60 * 1000
const BACKUP_KEEP = 50

/**
 * Atomic compare-and-set of the document plus revision counter.
 * Before overwriting, the previous document is pushed onto a capped backup list
 * (at most once per BACKUP_INTERVAL_MS) so a bad write can always be rolled back.
 *
 * KEYS: data, rev, backups, backupAt
 * ARGV: newJson, baseRev ('' = unconditional, legacy clients), nowMs, intervalMs, keep
 * Returns: { ok(1|0), rev }
 */
const SAVE_SCRIPT = `
local cur = redis.call('GET', KEYS[2]) or '0'
if ARGV[2] ~= '' and ARGV[2] ~= cur then
  return {0, cur}
end
local old = redis.call('GET', KEYS[1])
if old then
  local last = tonumber(redis.call('GET', KEYS[4]) or '0')
  local now = tonumber(ARGV[3])
  if now - last >= tonumber(ARGV[4]) then
    redis.call('LPUSH', KEYS[3], ARGV[3] .. ':' .. cur .. '\\n' .. old)
    redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[5]) - 1)
    redis.call('SET', KEYS[4], ARGV[3])
  end
end
local nxt = tostring(tonumber(cur) + 1)
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], nxt)
return {1, nxt}
`

export interface StoredDocument {
  raw: string | null
  rev: string
}

export async function readAppData(): Promise<StoredDocument> {
  const redis = await getRedis()
  const [raw, rev] = await Promise.all([redis.get(KEYS.data), redis.get(KEYS.rev)])
  return { raw, rev: rev ?? '0' }
}

export type SaveResult = { ok: true; rev: string } | { ok: false; rev: string }

export async function writeAppData(json: string, baseRev: string | null): Promise<SaveResult> {
  const redis = await getRedis()
  const reply = await redis.eval(SAVE_SCRIPT, {
    keys: [KEYS.data, KEYS.rev, KEYS.backups, KEYS.backupAt],
    arguments: [json, baseRev ?? '', String(Date.now()), String(BACKUP_INTERVAL_MS), String(BACKUP_KEEP)],
  }) as [number, string]
  return { ok: Number(reply[0]) === 1, rev: String(reply[1]) }
}
