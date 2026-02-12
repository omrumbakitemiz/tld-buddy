/**
 * Import items from The Long Dark Fandom Wiki via MediaWiki API.
 *
 * Usage:  npx tsx scripts/import-wiki-items.ts
 *
 * Outputs:
 *   public/data/items.json   – structured item list
 *   public/items/*.png       – downloaded icon images
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

// ── Config ──────────────────────────────────────────────────────────────────

const API_BASE = 'https://thelongdark.fandom.com/api.php'
const WIKI_BASE = 'https://thelongdark.fandom.com/wiki'
const DELAY_MS = 500 // 500ms between every API call
const ITEMS_DIR = path.resolve(import.meta.dirname, '..', 'public', 'items')
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'public', 'data')

// Top-level categories to crawl
const ROOT_CATEGORIES = [
  'Category:Tools',
  'Category:Clothing',
  'Category:First Aid',
  'Category:Fire Starting',
  'Category:Collectibles',
  'Category:Food And Drink',
  'Category:Materials',
  'Category:Plants',
  'Category:Craftable tools',
  'Category:Craftable clothing',
]

// Wiki categories → app category mapping
const CATEGORY_MAP: Record<string, string> = {
  // Weapons
  'Category:Weapons': 'Weapon',
  'Category:Firearms': 'Weapon',
  'Category:Ammunition': 'Ammunition',
  // Fire & Light
  'Category:Fire Starting': 'Fire/Light',
  'Category:Light Sources': 'Fire/Light',
  // Tools
  'Category:Cooking': 'Tool',
  'Category:Fishing': 'Tool',
  'Category:Hand Tools': 'Tool',
  'Category:Repair': 'Tool',
  'Category:Tools': 'Tool',
  'Category:Craftable tools': 'Tool',
  'Category:Sleep': 'Equipment',
  // Medical
  'Category:First Aid': 'Medical',
  // Clothing
  'Category:Clothing': 'Clothing',
  'Category:Craftable clothing': 'Clothing',
  'Category:Headwear': 'Clothing',
  'Category:Footwear': 'Clothing',
  'Category:Handwear': 'Clothing',
  'Category:Legwear': 'Clothing',
  'Category:Outerwear': 'Clothing',
  'Category:Innerwear': 'Clothing',
  'Category:Accessories': 'Clothing',
  // Food & Drink
  'Category:Food And Drink': 'Food',
  'Category:Fish': 'Food',
  // Resources / Materials
  'Category:Materials': 'Resource',
  'Category:Fuel': 'Resource',
  'Category:Plants': 'Resource',
  // Collectibles
  'Category:Collectibles': 'Collectible',
}

// Categories to exclude items from (story-only items, interactable objects, etc.)
const EXCLUDE_CATEGORIES = new Set([
  'Category:Story items',
  'Category:Interactable Objects',
  'Category:Interactable objects',
])

// Pages to skip (overview pages, user pages, etc.)
const SKIP_TITLES = new Set([
  'Clothing',
  'Tools',
  'Collectibles',
  'Items',
  'Wildlife',
  'Hunting',
  'Struggle',
  'Trapping',
])

// ── Types ───────────────────────────────────────────────────────────────────

interface WikiItem {
  id: string
  name: string
  category: string
  wikiUrl: string
  icon: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toKebabCase(str: string): string {
  return str
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
    throw new Error(`API error ${res.status}: ${res.statusText} for ${url.toString()}`)
  }

  return res.json()
}

// ── Step 1: Fetch all page titles from categories ───────────────────────────

async function fetchCategoryMembers(category: string): Promise<{ pageid: number; title: string }[]> {
  const members: { pageid: number; title: string }[] = []
  let cmcontinue: string | undefined

  console.log(`  Fetching category: ${category}`)

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
      // Skip ns != 0 (non-article pages like User: pages)
      if (member.ns !== 0) continue
      members.push({ pageid: member.pageid, title: member.title })
    }

    console.log(`    ... got ${batch.length} members (total: ${members.length})`)

    if (data.continue?.cmcontinue) {
      cmcontinue = data.continue.cmcontinue
    } else {
      break
    }
  }

  return members
}

// ── Step 2: Fetch categories for a page ─────────────────────────────────────

async function fetchPageCategories(title: string): Promise<string[]> {
  const data = await apiFetch({
    action: 'query',
    titles: title,
    prop: 'categories',
    cllimit: '50',
  })

  const pages = data.query?.pages ?? {}
  const page = Object.values(pages)[0] as any
  if (!page?.categories) return []

  return page.categories.map((c: any) => c.title as string)
}

// ── Step 3: Resolve best category ───────────────────────────────────────────

function resolveCategory(wikiCategories: string[]): string {
  // Priority order: more specific wins
  const priorityOrder = [
    'Weapon', 'Ammunition', 'Fire/Light', 'Medical',
    'Food', 'Clothing', 'Resource', 'Equipment', 'Collectible', 'Tool',
  ]

  const mapped = new Set<string>()
  for (const wc of wikiCategories) {
    const appCat = CATEGORY_MAP[wc]
    if (appCat) mapped.add(appCat)
  }

  for (const cat of priorityOrder) {
    if (mapped.has(cat)) return cat
  }

  return 'Tool'
}

// Check if a page belongs to an excluded category (e.g. Story items)
function isExcluded(wikiCategories: string[]): boolean {
  return wikiCategories.some((c) => EXCLUDE_CATEGORIES.has(c))
}

// ── Step 4: Download icon image ─────────────────────────────────────────────

async function downloadIcon(title: string, id: string): Promise<string | null> {
  const iconTitle = `File:${title.replace(/ /g, '_')}_icon.png`

  // Query imageinfo for the CDN URL
  const data = await apiFetch({
    action: 'query',
    titles: iconTitle,
    prop: 'imageinfo',
    iiprop: 'url',
  })

  const pages = data.query?.pages ?? {}
  const page = Object.values(pages)[0] as any

  // Page ID of -1 means the file doesn't exist
  if (!page || page.pageid === undefined || page.missing !== undefined) {
    return null
  }

  const imageUrl = page.imageinfo?.[0]?.url
  if (!imageUrl) return null

  const filename = `${id}.png`
  const filepath = path.join(ITEMS_DIR, filename)

  // Skip if already downloaded
  if (existsSync(filepath)) {
    return `/items/${filename}`
  }

  try {
    await sleep(DELAY_MS)
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'TLDMapImporter/1.0 (hobby project; polite scraping)' },
    })

    if (!res.ok || !res.body) return null

    const writeStream = createWriteStream(filepath)
    await pipeline(Readable.fromWeb(res.body as any), writeStream)

    return `/items/${filename}`
  } catch (err) {
    console.warn(`    ⚠ Failed to download icon for ${title}:`, (err as Error).message)
    return null
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TLD Wiki Item Import ===\n')

  // Ensure output dirs exist
  mkdirSync(ITEMS_DIR, { recursive: true })
  mkdirSync(DATA_DIR, { recursive: true })

  // Step 1: Collect all unique page titles from root categories
  console.log('Step 1: Fetching items from wiki categories...\n')

  const allPages = new Map<number, { title: string; sourceCategory: string }>() // pageid → info (dedup)

  for (const cat of ROOT_CATEGORIES) {
    const members = await fetchCategoryMembers(cat)
    for (const m of members) {
      if (!SKIP_TITLES.has(m.title) && !allPages.has(m.pageid)) {
        allPages.set(m.pageid, { title: m.title, sourceCategory: cat })
      }
    }
  }

  console.log(`\nFound ${allPages.size} unique items.\n`)

  // Step 2 + 3 + 4: For each item, fetch categories, resolve app category, download icon
  console.log('Step 2: Fetching item details and downloading icons...\n')

  const items: WikiItem[] = []
  let processed = 0

  for (const [_pageid, { title, sourceCategory }] of allPages) {
    processed++
    const id = toKebabCase(title)

    console.log(`  [${processed}/${allPages.size}] ${title}`)

    // Fetch wiki categories
    const wikiCats = await fetchPageCategories(title)

    // Skip items in excluded categories (story items, interactable objects, etc.)
    if (isExcluded(wikiCats)) {
      console.log(`    → excluded (story/interactable), skipping`)
      continue
    }

    // Include the source crawl category for resolution
    if (!wikiCats.includes(sourceCategory)) wikiCats.push(sourceCategory)
    const category = resolveCategory(wikiCats)

    // Download icon
    const icon = await downloadIcon(title, id)

    if (!icon) {
      console.log(`    → no icon found, skipping`)
    }

    items.push({
      id,
      name: title,
      category,
      wikiUrl: `${WIKI_BASE}/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      icon,
    })
  }

  // Sort by category then name
  items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.name.localeCompare(b.name)
  })

  // Step 5: Write JSON
  const jsonPath = path.join(DATA_DIR, 'items.json')
  writeFileSync(jsonPath, JSON.stringify(items, null, 2))

  // Summary
  const withIcons = items.filter((i) => i.icon).length
  const categories = [...new Set(items.map((i) => i.category))].sort()

  console.log(`\n=== Done ===`)
  console.log(`Total items: ${items.length}`)
  console.log(`With icons:  ${withIcons}`)
  console.log(`Categories:  ${categories.join(', ')}`)
  console.log(`Output:      ${jsonPath}`)
  console.log(`Icons:       ${ITEMS_DIR}/`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
