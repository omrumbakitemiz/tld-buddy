import type { Difficulty } from '~/types'

/** Pastel per-difficulty tints, from gentle (pilgrim) to harsh (misery). */
const STYLES: Record<Difficulty, string> = {
  pilgrim: 'bg-[oklch(0.84_0.085_170/0.16)] text-[oklch(0.86_0.08_170)] border-[oklch(0.84_0.085_170/0.45)]',
  voyageur: 'bg-[oklch(0.83_0.07_230/0.16)] text-[oklch(0.86_0.07_230)] border-[oklch(0.83_0.07_230/0.45)]',
  stalker: 'bg-[oklch(0.84_0.13_85/0.16)] text-[oklch(0.86_0.12_85)] border-[oklch(0.84_0.13_85/0.45)]',
  interloper: 'bg-[oklch(0.7_0.15_27/0.18)] text-[oklch(0.8_0.12_27)] border-[oklch(0.7_0.15_27/0.5)]',
  misery: 'bg-[oklch(0.72_0.1_300/0.18)] text-[oklch(0.84_0.08_300)] border-[oklch(0.72_0.1_300/0.5)]',
}

export function difficultyClass(d: Difficulty): string {
  return STYLES[d] ?? STYLES.voyageur
}
