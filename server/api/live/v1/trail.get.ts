import { isSaveId } from '#shared/utils/live'
import { isAuthenticated } from '../../../utils/auth'
import { StorageUnavailableError } from '../../../utils/redis'
import { readTrail } from '../../../utils/trail'

/** The breadcrumb trail of a game save (`?save=Sandbox-12`), oldest point first. */
export default defineEventHandler(async (event) => {
  try {
    if (!(await isAuthenticated(event))) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    const save = getQuery(event).save
    if (!isSaveId(save)) throw createError({ statusCode: 400, statusMessage: 'save must be a save id' })
    return { points: await readTrail(save) }
  } catch (err) {
    if (err instanceof StorageUnavailableError) throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
    throw err
  }
})
