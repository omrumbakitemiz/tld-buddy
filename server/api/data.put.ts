import { validateAppData } from '#shared/utils/appData'
import { readAppData, writeAppData } from '../utils/appDataStore'
import { StorageUnavailableError } from '../utils/redis'
import { readLimitedBody } from '../utils/body'

const MAX_BODY_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  // Optimistic concurrency is mandatory: a save must say which revision it builds on.
  // Builds from before revisions existed get told to reload instead of overwriting.
  const baseRev = getHeader(event, 'x-base-rev')?.trim()
  if (!baseRev || !/^\d+$/.test(baseRev)) {
    throw createError({
      statusCode: 428,
      statusMessage: 'Precondition Required',
      message: 'This version of TLD Buddy is out of date. Reload the page to keep saving.',
    })
  }

  // Byte limit enforced on the stream, so chunked uploads without Content-Length can't bypass it
  const text = await readLimitedBody(event, MAX_BODY_BYTES)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }
  // Reject anything that is not a well-formed AppData document so a buggy client cannot wipe storage
  const problem = validateAppData(body)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data payload', message: problem })
  }

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
    if (err instanceof StorageUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to save data' })
  }
})
