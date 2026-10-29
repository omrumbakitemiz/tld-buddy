import { normalizeAppData } from '#shared/utils/appData'
import { hudData } from '#shared/utils/hud'
import { isSaveId, type MapCalibration } from '#shared/utils/live'
import type { GameMap, GameScene } from '#shared/types/game'
import { readAppData } from '../../../utils/appDataStore'
import { getModToken } from '../../../utils/config'
import { isModRequest } from '../../../utils/live'
import { StorageUnavailableError } from '../../../utils/redis'

const SCENE = /^[A-Za-z0-9_]{1,64}$/

async function gameData<T>(file: string, empty: T): Promise<T> {
  return ((await useStorage('assets:gamedata').getItem<T>(file)) ?? empty) as T
}

/**
 * The game mod's in-game HUD: markers of the save's run near the player, in world coordinates.
 * `?save=Sandbox-12&scene=LakeRegion&x=..&z=..`. Authenticated with MOD_TOKEN, like the other mod routes.
 */
export default defineEventHandler(async (event) => {
  if (!getModToken()) throw createError({ statusCode: 403, statusMessage: 'Live bridge disabled' })
  if (!isModRequest(event)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const q = getQuery(event)
  const x = Number(q.x), z = Number(q.z)
  if (!isSaveId(q.save) || typeof q.scene !== 'string' || !SCENE.test(q.scene) || !Number.isFinite(x) || !Number.isFinite(z)) {
    throw createError({ statusCode: 400, statusMessage: 'Needs save, scene, x and z' })
  }

  let raw: string | null
  try {
    raw = (await readAppData()).raw
  } catch (err) {
    if (err instanceof StorageUnavailableError) throw createError({ statusCode: 503, statusMessage: 'Storage unavailable' })
    throw err
  }
  const data = normalizeAppData(raw ? JSON.parse(raw) : {})
  const [scenes, calibration, maps] = await Promise.all([
    gameData<GameScene[]>('game-scenes.json', []),
    gameData<MapCalibration>('map-calibration.json', {}),
    gameData<GameMap[]>('maps.json', []),
  ])
  return hudData(data, q.save, { scene: q.scene, x, z }, scenes, calibration, maps)
})
