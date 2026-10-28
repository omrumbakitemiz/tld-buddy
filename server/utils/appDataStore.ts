import { withStorage } from './redis'

/** Redis keys. `app-data` keeps the exact JSON shape older builds wrote and read. */
export const KEYS = {
  data: 'app-data',
  rev: 'app-data:rev',
  backups: 'app-data:backups',
  backupAt: 'app-data:backup-at',
} as const

const BACKUP_INTERVAL_MS = 10 * 60 * 1000
const BACKUP_KEEP = 50
/** Total size cap for the backup list; the newest backup is always kept even if larger. */
const BACKUP_MAX_BYTES = 25 * 1024 * 1024

/**
 * Atomic compare-and-set of the document plus revision counter.
 * Before overwriting, the previous document is pushed onto a capped backup list
 * (at most once per interval, at most BACKUP_KEEP entries and BACKUP_MAX_BYTES total)
 * so a bad write can always be rolled back.
 *
 * KEYS: data, rev, backups, backupAt
 * ARGV: newJson, baseRev, nowMs, intervalMs, keep, maxBytes
 * Returns: { ok(1|0), rev }
 */
const SAVE_SCRIPT = `
local cur = redis.call('GET', KEYS[2]) or '0'
if ARGV[2] ~= cur then
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
    local budget = tonumber(ARGV[6])
    local total = 0
    local items = redis.call('LRANGE', KEYS[3], 0, -1)
    for i, v in ipairs(items) do
      total = total + string.len(v)
      if total > budget and i > 1 then
        redis.call('LTRIM', KEYS[3], 0, i - 2)
        break
      end
    end
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

/** Document and revision in one round trip, so a stale document never pairs with a newer revision. */
export async function readAppData(): Promise<StoredDocument> {
  return withStorage(async (redis) => {
    const [raw, rev] = await redis.mGet([KEYS.data, KEYS.rev])
    return { raw: raw ?? null, rev: rev ?? '0' }
  })
}

export type SaveResult = { ok: boolean; rev: string }

export async function writeAppData(json: string, baseRev: string): Promise<SaveResult> {
  return withStorage(async (redis) => {
    const reply = await redis.eval(SAVE_SCRIPT, {
      keys: [KEYS.data, KEYS.rev, KEYS.backups, KEYS.backupAt],
      arguments: [json, baseRev, String(Date.now()), String(BACKUP_INTERVAL_MS), String(BACKUP_KEEP), String(BACKUP_MAX_BYTES)],
    }) as [number, string]
    return { ok: Number(reply[0]) === 1, rev: String(reply[1]) }
  })
}
