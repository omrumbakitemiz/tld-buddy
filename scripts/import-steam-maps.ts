/**
 * Import region maps from HokuOwl's Steam Community Guide.
 * Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617
 *
 * Usage:  npx tsx scripts/import-steam-maps.ts
 *
 * Outputs:
 *   public/data/maps.json    – structured map list with default + interloper variants
 *   public/maps/*.jpg        – downloaded map images
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

// ── Config ──────────────────────────────────────────────────────────────────

const GUIDE_URL = 'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617'
const STEAM_UGC_BASE = 'https://images.steamusercontent.com/ugc'
const DELAY_MS = 500
const MAPS_DIR = path.resolve(import.meta.dirname, '..', 'public', 'maps')
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'public', 'data')

// ── Region definitions (order matches the Steam guide) ──────────────────────

interface RegionDef {
  id: string
  name: string
  type: 'region' | 'transition'
  isDLC: boolean
  singleVariant?: boolean // Crumbling Highway only has 1 variant
}

const REGIONS: RegionDef[] = [
  // Major Regions (16)
  { id: 'mystery-lake', name: 'Mystery Lake', type: 'region', isDLC: false },
  { id: 'coastal-highway', name: 'Coastal Highway', type: 'region', isDLC: false },
  { id: 'pleasant-valley', name: 'Pleasant Valley', type: 'region', isDLC: false },
  { id: 'desolation-point', name: 'Desolation Point', type: 'region', isDLC: false },
  { id: 'timberwolf-mountain', name: 'Timberwolf Mountain', type: 'region', isDLC: false },
  { id: 'forlorn-muskeg', name: 'Forlorn Muskeg', type: 'region', isDLC: false },
  { id: 'broken-railroad', name: 'Broken Railroad', type: 'region', isDLC: false },
  { id: 'mountain-town', name: 'Mountain Town', type: 'region', isDLC: false },
  { id: 'hushed-river-valley', name: 'Hushed River Valley', type: 'region', isDLC: false },
  { id: 'bleak-inlet', name: 'Bleak Inlet', type: 'region', isDLC: false },
  { id: 'ash-canyon', name: 'Ash Canyon', type: 'region', isDLC: false },
  { id: 'blackrock', name: 'Blackrock', type: 'region', isDLC: false },
  { id: 'transfer-pass', name: 'Transfer Pass', type: 'region', isDLC: true },
  { id: 'forsaken-airfield', name: 'Forsaken Airfield', type: 'region', isDLC: true },
  { id: 'zone-of-contamination', name: 'Zone of Contamination', type: 'region', isDLC: true },
  { id: 'sundered-pass', name: 'Sundered Pass', type: 'region', isDLC: true },
  // Transition Zones (5)
  { id: 'ravine', name: 'Ravine', type: 'transition', isDLC: false },
  { id: 'winding-river', name: 'Winding River & Carter Hydro Dam', type: 'transition', isDLC: false },
  { id: 'crumbling-highway', name: 'Crumbling Highway', type: 'transition', isDLC: false, singleVariant: true },
  { id: 'keepers-pass', name: "Keeper's Pass", type: 'transition', isDLC: false },
  { id: 'far-range-branch-line', name: 'Far Range Branch Line', type: 'transition', isDLC: true },
]

// ── Types ───────────────────────────────────────────────────────────────────

interface MapVariant {
  imageUrl: string
  imageWidth: number
  imageHeight: number
}

interface SteamMap {
  id: string
  name: string
  type: 'region' | 'transition'
  isDLC: boolean
  default: MapVariant
  interloper: MapVariant
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadImage(url: string, filepath: string): Promise<boolean> {
  if (existsSync(filepath)) {
    console.log(`    → already downloaded`)
    return true
  }

  try {
    await sleep(DELAY_MS)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
    })
    if (!res.ok || !res.body) {
      console.warn(`    ⚠ HTTP ${res.status} for ${url}`)
      return false
    }

    const writeStream = createWriteStream(filepath)
    await pipeline(Readable.fromWeb(res.body as any), writeStream)
    return true
  } catch (err) {
    console.warn(`    ⚠ Download failed: ${(err as Error).message}`)
    return false
  }
}

async function getImageDimensions(filepath: string): Promise<{ width: number; height: number }> {
  // Use a simple approach: read the first bytes to detect JPEG/PNG dimensions
  const { readFileSync } = await import('node:fs')
  const buf = readFileSync(filepath)

  // JPEG: search for SOF0 marker (0xFF 0xC0)
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xFF) { offset++; continue }
      const marker = buf[offset + 1]
      const len = buf.readUInt16BE(offset + 2)
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        const height = buf.readUInt16BE(offset + 5)
        const width = buf.readUInt16BE(offset + 7)
        return { width, height }
      }
      offset += 2 + len
    }
  }

  // PNG: width and height at bytes 16-23
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return { width, height }
  }

  // Fallback
  return { width: 2048, height: 2048 }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TLD Steam Map Import ===\n')

  mkdirSync(MAPS_DIR, { recursive: true })
  mkdirSync(DATA_DIR, { recursive: true })

  // Step 1: Fetch the guide HTML
  console.log('Step 1: Fetching Steam guide HTML...\n')

  const res = await fetch(GUIDE_URL, {
    headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
  })
  if (!res.ok) throw new Error(`Failed to fetch guide: HTTP ${res.status}`)
  const html = await res.text()
  console.log(`  HTML length: ${html.length} bytes\n`)

  // Step 2: Extract sections and their images
  console.log('Step 2: Parsing guide sections...\n')

  const sectionRegex = /class="subSectionTitle">\s*(.*?)\s*<\/div>\s*<div class="subSectionDesc">([\s\S]*?)(?=<div[^>]*class="subSection|$)/g
  const sections: { title: string; images: string[] }[] = []

  for (const match of html.matchAll(sectionRegex)) {
    const title = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
    const body = match[2]

    // Extract unique UGC image URLs (keep trailing slash — required by Steam CDN)
    const imgUrls = [...new Set(
      [...body.matchAll(/https:\/\/images\.steamusercontent\.com\/ugc\/[\d]+\/[A-F0-9]+\//g)]
        .map(m => m[0])
    )]

    sections.push({ title, images: imgUrls })
  }

  console.log(`  Found ${sections.length} sections\n`)

  // Step 3: Map sections to regions and download images
  console.log('Step 3: Downloading map images...\n')

  // Build a map of region sections (skip overview sections)
  const regionSections = sections.filter(s =>
    s.images.length > 0 &&
    !s.title.includes('Additions') &&
    !s.title.includes('Must-Read') &&
    !s.title.includes('Guide Change') &&
    !s.title.includes('--------')
  )

  console.log(`  ${regionSections.length} region sections with images\n`)

  if (regionSections.length !== REGIONS.length) {
    console.warn(`  ⚠ Expected ${REGIONS.length} regions but found ${regionSections.length} sections`)
    console.warn(`  Sections found:`)
    regionSections.forEach((s, i) => console.warn(`    ${i}: "${s.title}" (${s.images.length} imgs)`))
    console.warn('')
  }

  const maps: SteamMap[] = []

  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i]
    const section = regionSections[i]

    if (!section) {
      console.warn(`  ⚠ No section found for ${region.name}, skipping`)
      continue
    }

    console.log(`  [${i + 1}/${REGIONS.length}] ${region.name}`)
    console.log(`    Section: "${section.title}" (${section.images.length} images)`)

    // First image = default (Pilgrim/Voyageur/Stalker)
    // Second image = interloper (Interloper/Misery)
    // Additional images = supplementary (fishing spots, shortcuts) - skip
    const defaultUrl = section.images[0]
    const interloperUrl = region.singleVariant ? section.images[0] : section.images[1]

    if (!defaultUrl) {
      console.warn(`    ⚠ No default image found, skipping`)
      continue
    }
    if (!interloperUrl) {
      console.warn(`    ⚠ No interloper image found, using default for both`)
    }

    // Download default variant
    const defaultFilename = `${region.id}-default.jpg`
    const defaultFilepath = path.join(MAPS_DIR, defaultFilename)
    console.log(`    Downloading default...`)
    const defaultOk = await downloadImage(defaultUrl, defaultFilepath)

    // Download interloper variant
    const interloperFilename = `${region.id}-interloper.jpg`
    const interloperFilepath = path.join(MAPS_DIR, interloperFilename)
    console.log(`    Downloading interloper...`)
    const interloperOk = await downloadImage(interloperUrl || defaultUrl, interloperFilepath)

    if (!defaultOk || !interloperOk) {
      console.warn(`    ⚠ Download failed for one or both variants, skipping`)
      continue
    }

    // Get dimensions
    const defaultDims = await getImageDimensions(defaultFilepath)
    const interloperDims = await getImageDimensions(interloperFilepath)

    console.log(`    Default: ${defaultDims.width}x${defaultDims.height}px`)
    console.log(`    Interloper: ${interloperDims.width}x${interloperDims.height}px`)

    maps.push({
      id: region.id,
      name: region.name,
      type: region.type,
      isDLC: region.isDLC,
      default: {
        imageUrl: `/maps/${defaultFilename}`,
        imageWidth: defaultDims.width,
        imageHeight: defaultDims.height,
      },
      interloper: {
        imageUrl: `/maps/${interloperFilename}`,
        imageWidth: interloperDims.width,
        imageHeight: interloperDims.height,
      },
    })
  }

  // Write JSON
  const jsonPath = path.join(DATA_DIR, 'maps.json')
  writeFileSync(jsonPath, JSON.stringify(maps, null, 2))

  const regions = maps.filter(m => m.type === 'region').length
  const transitions = maps.filter(m => m.type === 'transition').length

  console.log(`\n=== Done ===`)
  console.log(`Regions:     ${regions}`)
  console.log(`Transitions: ${transitions}`)
  console.log(`Total maps:  ${maps.length} (${maps.length * 2} images)`)
  console.log(`Output:      ${jsonPath}`)
  console.log(`Images:      ${MAPS_DIR}/`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
