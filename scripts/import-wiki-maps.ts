/**
 * Import region maps from The Long Dark Fandom Wiki via MediaWiki API.
 *
 * Usage:  npx tsx scripts/import-wiki-maps.ts
 *
 * Outputs:
 *   public/data/maps.json    – structured map/region list
 *   public/maps/*.jpg|png    – downloaded map images
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

// ── Config ──────────────────────────────────────────────────────────────────

const API_BASE = 'https://thelongdark.fandom.com/api.php'
const WIKI_BASE = 'https://thelongdark.fandom.com/wiki'
const DELAY_MS = 500
const MAPS_DIR = path.resolve(import.meta.dirname, '..', 'public', 'maps')
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'public', 'data')

const REGION_CATEGORIES = ['Category:Regions', 'Category:Transition zones']

// Skip overview/meta pages
const SKIP_TITLES = new Set(['Region'])

// ── Types ───────────────────────────────────────────────────────────────────

interface WikiMap {
  id: string
  name: string
  type: 'region' | 'transition'
  imageUrl: string
  imageWidth: number
  imageHeight: number
  wikiUrl: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toKebabCase(str: string): string {
  return str
    .replace(/\(.*?\)/g, '') // remove parenthetical like "(region)"
    .replace(/['']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

async function apiFetch(params: Record<string, string>): Promise<any> {
  const url = new URL(API_BASE)
  url.searchParams.set('format', 'json')
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val)
  }

  await sleep(DELAY_MS)

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  return res.json()
}

// ── Fetch category members ──────────────────────────────────────────────────

async function fetchCategoryMembers(category: string): Promise<{ pageid: number; title: string }[]> {
  const members: { pageid: number; title: string }[] = []
  let cmcontinue: string | undefined

  console.log(`  Fetching: ${category}`)

  while (true) {
    const params: Record<string, string> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '50',
      cmtype: 'page',
    }
    if (cmcontinue) params.cmcontinue = cmcontinue

    const data = await apiFetch(params)
    const batch = data.query?.categorymembers ?? []

    for (const member of batch) {
      if (member.ns === 0) members.push({ pageid: member.pageid, title: member.title })
    }

    if (data.continue?.cmcontinue) {
      cmcontinue = data.continue.cmcontinue
    } else {
      break
    }
  }

  console.log(`    → ${members.length} pages`)
  return members
}

// ── Fetch all images for a page ─────────────────────────────────────────────

async function fetchPageImages(title: string): Promise<string[]> {
  const images: string[] = []
  let imcontinue: string | undefined

  while (true) {
    const params: Record<string, string> = {
      action: 'query',
      titles: title,
      prop: 'images',
      imlimit: '50',
    }
    if (imcontinue) params.imcontinue = imcontinue

    const data = await apiFetch(params)
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0] as any

    if (page?.images) {
      for (const img of page.images) {
        images.push(img.title as string)
      }
    }

    if (data.continue?.imcontinue) {
      imcontinue = data.continue.imcontinue
    } else {
      break
    }
  }

  return images
}

// ── Pick the best map image from a list of image titles ─────────────────────

function pickBestMapImage(images: string[], regionTitle: string): string | null {
  // Normalize region name for matching
  const regionLower = regionTitle.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Score each image - higher is better
  const scored = images
    .filter((img) => {
      const lower = img.toLowerCase()
      // Must look like a map image
      return (
        lower.includes('map') ||
        lower.includes('region') ||
        lower.includes('lv3') ||
        lower.includes('default')
      )
    })
    .filter((img) => {
      const lower = img.toLowerCase()
      // Exclude non-map images
      return (
        !lower.includes('title card') &&
        !lower.includes('titlecard') &&
        !lower.includes('poster') &&
        !lower.includes('location.png') && // small location indicator
        !lower.includes('thumbnail') &&
        !lower.includes('ice cave') &&
        !lower.includes('icecave')
      )
    })
    .map((img) => {
      let score = 0
      const lower = img.toLowerCase()

      // Prefer images that mention the region name
      const imgNorm = lower.replace(/[^a-z0-9]/g, '')
      if (imgNorm.includes(regionLower)) score += 10

      // Prefer "default" or non-loper maps (standard difficulty)
      if (lower.includes('default') || lower.includes('pilgrim') || lower.includes('stalker')) score += 5

      // Prefer "region map" style
      if (lower.includes('region map') || lower.includes('region_map')) score += 8

      // Prefer versioned maps (likely more up to date)
      if (lower.includes('v2.') || lower.includes('v1.')) score += 4

      // Prefer lv3 (detailed) maps
      if (lower.includes('lv3')) score += 6

      // Prefer "map" in the name (generic but good)
      if (lower.includes(' map.') || lower.includes(' map ') || lower.endsWith(' map')) score += 3

      // Prefer community maps (Sniper Bob, etc.)
      if (lower.includes('sniper bob')) score += 7

      // Slight preference for jpg (usually photos/detailed maps) over png
      if (lower.endsWith('.jpg')) score += 1

      // Penalize "loper" maps (interloper has fewer items)
      if (lower.includes('loper') || lower.includes('interloper')) score -= 3

      // Penalize "spoil" maps (may have story spoilers marked)
      if (lower.includes('spoil')) score -= 2

      return { title: img, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored.length > 0 ? scored[0].title : null
}

// ── Get image info (URL + dimensions) ───────────────────────────────────────

async function getImageInfo(imageTitle: string): Promise<{ url: string; width: number; height: number } | null> {
  const data = await apiFetch({
    action: 'query',
    titles: imageTitle,
    prop: 'imageinfo',
    iiprop: 'url|size',
  })

  const pages = data.query?.pages ?? {}
  const page = Object.values(pages)[0] as any

  if (!page?.imageinfo?.[0]) return null

  const info = page.imageinfo[0]
  return { url: info.url, width: info.width, height: info.height }
}

// ── Download image ──────────────────────────────────────────────────────────

async function downloadImage(url: string, filepath: string): Promise<boolean> {
  if (existsSync(filepath)) return true

  try {
    await sleep(DELAY_MS)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
    })

    if (!res.ok || !res.body) return false

    const writeStream = createWriteStream(filepath)
    await pipeline(Readable.fromWeb(res.body as any), writeStream)
    return true
  } catch (err) {
    console.warn(`    ⚠ Download failed: ${(err as Error).message}`)
    return false
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TLD Wiki Map Import ===\n')

  mkdirSync(MAPS_DIR, { recursive: true })
  mkdirSync(DATA_DIR, { recursive: true })

  // Step 1: Fetch all regions and transition zones
  console.log('Step 1: Fetching regions and transition zones...\n')

  const allRegions: { title: string; type: 'region' | 'transition' }[] = []
  const seen = new Set<number>()

  for (const cat of REGION_CATEGORIES) {
    const type = cat.includes('Transition') ? 'transition' : 'region'
    const members = await fetchCategoryMembers(cat)
    for (const m of members) {
      if (!SKIP_TITLES.has(m.title) && !seen.has(m.pageid)) {
        seen.add(m.pageid)
        allRegions.push({ title: m.title, type: type as 'region' | 'transition' })
      }
    }
  }

  console.log(`\nFound ${allRegions.length} regions/zones.\n`)

  // Step 2: For each region, find and download the best map image
  console.log('Step 2: Finding and downloading map images...\n')

  const maps: WikiMap[] = []

  for (let i = 0; i < allRegions.length; i++) {
    const { title, type } = allRegions[i]
    const id = toKebabCase(title)
    const cleanName = title.replace(/ \(region\)/i, '').replace(/ \(Transition Zone\)/i, '')

    console.log(`  [${i + 1}/${allRegions.length}] ${cleanName} (${type})`)

    // Fetch all images on the page
    const images = await fetchPageImages(title)
    console.log(`    → ${images.length} images on page`)

    // Pick best map
    const bestImage = pickBestMapImage(images, cleanName)

    if (!bestImage) {
      console.log(`    → no suitable map image found, skipping`)
      continue
    }

    console.log(`    → selected: ${bestImage}`)

    // Get URL and dimensions
    const info = await getImageInfo(bestImage)
    if (!info) {
      console.log(`    → could not get image info, skipping`)
      continue
    }

    console.log(`    → ${info.width}x${info.height}px`)

    // Download
    const ext = bestImage.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
    const filename = `${id}.${ext}`
    const filepath = path.join(MAPS_DIR, filename)

    const ok = await downloadImage(info.url, filepath)
    if (!ok) {
      console.log(`    → download failed, skipping`)
      continue
    }

    console.log(`    → saved: ${filename}`)

    maps.push({
      id: `map-${id}`,
      name: cleanName,
      type,
      imageUrl: `/maps/${filename}`,
      imageWidth: info.width,
      imageHeight: info.height,
      wikiUrl: `${WIKI_BASE}/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    })
  }

  // Sort: regions first, then transition zones, alphabetical within each
  maps.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'region' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  // Write JSON
  const jsonPath = path.join(DATA_DIR, 'maps.json')
  writeFileSync(jsonPath, JSON.stringify(maps, null, 2))

  const regions = maps.filter((m) => m.type === 'region').length
  const transitions = maps.filter((m) => m.type === 'transition').length

  console.log(`\n=== Done ===`)
  console.log(`Regions:     ${regions}`)
  console.log(`Transitions: ${transitions}`)
  console.log(`Total maps:  ${maps.length}`)
  console.log(`Output:      ${jsonPath}`)
  console.log(`Images:      ${MAPS_DIR}/`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
