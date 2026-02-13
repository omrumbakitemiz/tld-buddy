/**
 * Import Points of Interest (locations) from The Long Dark wiki.
 * Fetches location data from each region's category via the MediaWiki API.
 *
 * Usage:  npx tsx scripts/import-wiki-pois.ts
 *
 * Outputs:
 *   public/data/pois.json  – structured POI list with metadata
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// ── Config ──────────────────────────────────────────────────────────────────

const WIKI_API = 'https://thelongdark.fandom.com/api.php'
const DELAY_MS = 600 // conservative rate limiting
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'public', 'data')

// ── Region → wiki category mapping ─────────────────────────────────────────

interface RegionMapping {
  mapId: string
  name: string
  wikiCategory: string // e.g. "Locations in Ash Canyon"
}

const REGIONS: RegionMapping[] = [
  // Major regions
  { mapId: 'mystery-lake', name: 'Mystery Lake', wikiCategory: 'Locations in Mystery Lake' },
  { mapId: 'coastal-highway', name: 'Coastal Highway', wikiCategory: 'Locations in Coastal Highway' },
  { mapId: 'pleasant-valley', name: 'Pleasant Valley', wikiCategory: 'Locations in Pleasant Valley' },
  { mapId: 'desolation-point', name: 'Desolation Point', wikiCategory: 'Locations in Desolation Point' },
  { mapId: 'timberwolf-mountain', name: 'Timberwolf Mountain', wikiCategory: 'Locations in Timberwolf Mountain' },
  { mapId: 'forlorn-muskeg', name: 'Forlorn Muskeg', wikiCategory: 'Locations in Forlorn Muskeg' },
  { mapId: 'broken-railroad', name: 'Broken Railroad', wikiCategory: 'Locations in Broken Railroad' },
  { mapId: 'mountain-town', name: 'Mountain Town', wikiCategory: 'Locations in Mountain Town' },
  { mapId: 'hushed-river-valley', name: 'Hushed River Valley', wikiCategory: 'Locations in Hushed River Valley' },
  { mapId: 'bleak-inlet', name: 'Bleak Inlet', wikiCategory: 'Locations in Bleak Inlet' },
  { mapId: 'ash-canyon', name: 'Ash Canyon', wikiCategory: 'Locations in Ash Canyon' },
  { mapId: 'blackrock', name: 'Blackrock', wikiCategory: 'Locations in Blackrock' },
  { mapId: 'transfer-pass', name: 'Transfer Pass', wikiCategory: 'Locations in Transfer Pass' },
  { mapId: 'forsaken-airfield', name: 'Forsaken Airfield', wikiCategory: 'Locations in Forsaken Airfield' },
  { mapId: 'zone-of-contamination', name: 'Zone of Contamination', wikiCategory: 'Locations in Zone of Contamination' },
  { mapId: 'sundered-pass', name: 'Sundered Pass', wikiCategory: 'Locations in Sundered Pass' },
  // Transition zones
  { mapId: 'ravine', name: 'Ravine', wikiCategory: 'Locations in The Ravine' },
  { mapId: 'winding-river', name: 'Winding River & Carter Hydro Dam', wikiCategory: 'Locations in Winding River' },
  { mapId: 'crumbling-highway', name: 'Crumbling Highway', wikiCategory: 'Locations in Crumbling Highway' },
  { mapId: 'keepers-pass', name: "Keeper's Pass", wikiCategory: "Locations in Keeper's Pass North" },
  { mapId: 'far-range-branch-line', name: 'Far Range Branch Line', wikiCategory: 'Locations in Far Range Branch Line' },
]

// Also include Keeper's Pass South locations under the same map id
const EXTRA_CATEGORIES: { mapId: string; wikiCategory: string }[] = [
  { mapId: 'keepers-pass', wikiCategory: "Locations in Keeper's Pass South" },
  // Winding River also includes Carter Hydro Dam area
]

// ── Types ───────────────────────────────────────────────────────────────────

interface POI {
  id: string
  name: string
  mapId: string
  type?: string
  hasBed?: boolean
  hasWorkbench?: boolean
  hasShelter?: boolean
  hasForge?: boolean
  wikiUrl?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchJson(url: string): Promise<any> {
  await sleep(DELAY_MS)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

/**
 * Get all page titles in a wiki category (handles continuation).
 */
async function getCategoryMembers(categoryName: string): Promise<string[]> {
  const titles: string[] = []
  let cmcontinue: string | undefined

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${categoryName}`,
      cmtype: 'page',
      cmlimit: '50',
      format: 'json',
    })
    if (cmcontinue) params.set('cmcontinue', cmcontinue)

    const data = await fetchJson(`${WIKI_API}?${params}`)
    const members = data?.query?.categorymembers ?? []
    for (const m of members) {
      titles.push(m.title)
    }
    cmcontinue = data?.continue?.cmcontinue
  } while (cmcontinue)

  return titles
}

/**
 * Fetch page wikitext content and parse the Infobox/Location template.
 */
async function getLocationInfo(title: string): Promise<{
  type?: string
  hasBed?: boolean
  hasWorkbench?: boolean
  hasShelter?: boolean
  hasForge?: boolean
} | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
  })

  const data = await fetchJson(`${WIKI_API}?${params}`)
  const pages = data?.query?.pages
  if (!pages) return null

  const pageId = Object.keys(pages)[0]
  if (pageId === '-1') return null // page not found

  const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*']
  if (!content) return null

  // Parse infobox
  const infoboxMatch = content.match(/\{\{Infobox\/Location([\s\S]*?)\}\}/)
  if (!infoboxMatch) return null

  const infobox = infoboxMatch[0]

  function getField(name: string): string | undefined {
    const match = infobox.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|]+)`, 'i'))
    return match ? match[1].trim() : undefined
  }

  function isTruthy(val: string | undefined): boolean {
    if (!val) return false
    const v = val.toLowerCase().trim()
    return v === 'yes' || v === 'true' || v === 'partial'
  }

  return {
    type: getField('type') || undefined,
    hasBed: isTruthy(getField('bed')) || undefined,
    hasWorkbench: isTruthy(getField('workbench')) || undefined,
    hasShelter: isTruthy(getField('shelter')) || undefined,
    hasForge: isTruthy(getField('forge')) || undefined,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TLD POI Import ===\n')

  mkdirSync(DATA_DIR, { recursive: true })

  const allPOIs: POI[] = []
  const seenIds = new Set<string>()

  // Combine regions + extra categories
  const allCategories = [
    ...REGIONS.map((r) => ({ mapId: r.mapId, name: r.name, wikiCategory: r.wikiCategory })),
    ...EXTRA_CATEGORIES,
  ]

  let regionIndex = 0

  for (const { mapId, wikiCategory } of allCategories) {
    regionIndex++
    const regionName = REGIONS.find((r) => r.mapId === mapId)?.name ?? mapId
    console.log(`[${regionIndex}/${allCategories.length}] ${regionName} (${wikiCategory})`)

    // Step 1: Get location titles
    let titles: string[]
    try {
      titles = await getCategoryMembers(wikiCategory)
    } catch (err) {
      console.warn(`  ⚠ Failed to fetch category: ${(err as Error).message}`)
      continue
    }

    console.log(`  Found ${titles.length} locations`)

    // Step 2: For each location, fetch infobox data
    for (const title of titles) {
      const poiId = `${mapId}--${slugify(title)}`

      // Skip duplicates (from overlapping categories)
      if (seenIds.has(poiId)) {
        console.log(`  → ${title} (skipped, duplicate)`)
        continue
      }
      seenIds.add(poiId)

      console.log(`  → ${title}`)

      let info: Awaited<ReturnType<typeof getLocationInfo>> = null
      try {
        info = await getLocationInfo(title)
      } catch (err) {
        console.warn(`    ⚠ Failed to fetch page: ${(err as Error).message}`)
      }

      const poi: POI = {
        id: poiId,
        name: title,
        mapId,
        wikiUrl: `https://thelongdark.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      }

      if (info) {
        if (info.type) poi.type = info.type
        if (info.hasBed) poi.hasBed = true
        if (info.hasWorkbench) poi.hasWorkbench = true
        if (info.hasShelter) poi.hasShelter = true
        if (info.hasForge) poi.hasForge = true
      }

      allPOIs.push(poi)
    }
  }

  // Sort by mapId, then by name
  allPOIs.sort((a, b) => {
    if (a.mapId !== b.mapId) return a.mapId.localeCompare(b.mapId)
    return a.name.localeCompare(b.name)
  })

  // Write JSON
  const jsonPath = path.join(DATA_DIR, 'pois.json')
  writeFileSync(jsonPath, JSON.stringify(allPOIs, null, 2))

  // Stats
  const regionCounts = new Map<string, number>()
  for (const poi of allPOIs) {
    regionCounts.set(poi.mapId, (regionCounts.get(poi.mapId) ?? 0) + 1)
  }

  const withBed = allPOIs.filter((p) => p.hasBed).length
  const withWorkbench = allPOIs.filter((p) => p.hasWorkbench).length
  const withShelter = allPOIs.filter((p) => p.hasShelter).length
  const withForge = allPOIs.filter((p) => p.hasForge).length

  console.log(`\n=== Done ===`)
  console.log(`Total POIs: ${allPOIs.length}`)
  console.log(`Regions:    ${regionCounts.size}`)
  console.log(`With bed:       ${withBed}`)
  console.log(`With workbench: ${withWorkbench}`)
  console.log(`With shelter:   ${withShelter}`)
  console.log(`With forge:     ${withForge}`)
  console.log(`\nPer region:`)
  for (const [mapId, count] of [...regionCounts.entries()].sort()) {
    console.log(`  ${mapId}: ${count}`)
  }
  console.log(`\nOutput: ${jsonPath}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
