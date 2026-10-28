import { isAppDataPayload } from '#shared/utils/appData'
import { readAppData, writeAppData } from '../utils/appDataStore'

const MAX_BODY_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const length = Number(getHeader(event, 'content-length') ?? 0)
  if (length > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' })
  }

  const body = await readBody(event)
  // Reject anything that is not an AppData document so a buggy client cannot wipe storage
  if (!isAppDataPayload(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data payload' })
  }

  // Optimistic concurrency: clients send the revision their edits are based on.
  // Clients without the header (builds before revisions existed) keep last-write-wins.
  const baseRev = getHeader(event, 'x-base-rev')?.trim() || null

  try {
    const result = await writeAppData(JSON.stringify(body), baseRev)
    if (!result.ok) {
      // Someone else saved first: hand back the current document so the client can merge
      const current = await readAppData()
      setResponseStatus(event, 409, 'Conflict')
      setHeader(event, 'X-Data-Rev', current.rev)
      return { conflict: true, rev: current.rev, data: current.raw ? JSON.parse(current.raw) : null }
    }
    setHeader(event, 'X-Data-Rev', result.rev)
    return { ok: true, rev: result.rev }
  } catch (err) {
    console.error('Failed to write to Redis:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save data' })
  }
})
