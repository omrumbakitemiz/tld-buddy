/**
 * Map calibration tool for the game mod (dev only, runs on the gaming PC).
 *
 * Usage:  node scripts/calibrate/server.ts      (Node 23.6+ runs TypeScript directly)
 *         TLD_DIR="C:\path\to\TheLongDark" node scripts/calibrate/server.ts
 *
 * Serves a page at http://127.0.0.1:5174 that shows a region map next to the landmarks
 * the mod exported (UserData/TldBuddy/landmarks/<scene>.json). Place a few landmarks on
 * the map; the page fits an affine transform (world x/z → map x/y) and "Save" writes it
 * into public/data/map-calibration.json.
 */

import { createServer } from 'node:http'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const PORT = 5174
const ROOT = path.resolve(import.meta.dirname, '..', '..')
const PUBLIC_DIR = path.join(ROOT, 'public')
const CALIBRATION_PATH = path.join(PUBLIC_DIR, 'data', 'map-calibration.json')
const TLD_DIR = process.env.TLD_DIR ?? 'D:\\SteamLibrary\\steamapps\\common\\TheLongDark'
const LANDMARKS_DIR = path.join(TLD_DIR, 'UserData', 'TldBuddy', 'landmarks')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

async function readJson(file: string, fallback: unknown) {
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback
}

/** Resolves `rel` inside `base`, refusing anything that escapes it. */
function inside(base: string, rel: string): string | null {
  const full = path.resolve(base, '.' + path.sep + rel)
  return full.startsWith(base + path.sep) ? full : null
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const send = (status: number, body: string | Buffer, type = 'text/plain; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    res.end(body)
  }

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(200, await readFile(path.join(import.meta.dirname, 'index.html')), TYPES['.html'])
    }

    if (req.method === 'GET' && url.pathname === '/api/landmarks') {
      const files = existsSync(LANDMARKS_DIR) ? await readdir(LANDMARKS_DIR) : []
      const all = await Promise.all(
        files.filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(LANDMARKS_DIR, f), null)),
      )
      return send(200, JSON.stringify(all.filter(Boolean)), TYPES['.json'])
    }

    if (req.method === 'POST' && url.pathname === '/api/calibration') {
      // Body: { scene, mapId, variant, transform }. Merged so other scenes/variants are kept.
      let raw = ''
      for await (const chunk of req) raw += chunk
      const { scene, mapId, variant, transform } = JSON.parse(raw)
      if (typeof scene !== 'string' || typeof mapId !== 'string' || !['default', 'interloper'].includes(variant)) {
        return send(400, 'scene, mapId and variant (default|interloper) are required')
      }
      const all = await readJson(CALIBRATION_PATH, {})
      all[scene] = { ...all[scene], mapId, [variant]: transform }
      const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]))
      await writeFile(CALIBRATION_PATH, JSON.stringify(sorted, null, 2) + '\n')
      console.log(`Saved ${scene} (${mapId}, ${variant}) to ${path.relative(ROOT, CALIBRATION_PATH)}`)
      return send(200, JSON.stringify({ ok: true }), TYPES['.json'])
    }

    // Static files from public/ (maps.json, game-scenes.json, map-calibration.json, map images)
    if (req.method === 'GET') {
      const file = inside(PUBLIC_DIR, decodeURIComponent(url.pathname))
      if (file && existsSync(file)) {
        return send(200, await readFile(file), TYPES[path.extname(file)] ?? 'application/octet-stream')
      }
    }
    send(404, 'Not found')
  } catch (err) {
    console.error(err)
    send(500, String(err))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Calibration tool: http://127.0.0.1:${PORT}`)
  console.log(`Landmarks from:   ${LANDMARKS_DIR}${existsSync(LANDMARKS_DIR) ? '' : '  (missing: run the game with the mod first)'}`)
})
