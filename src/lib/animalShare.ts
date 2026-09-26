import type { AnimalStats } from './statsService';

/** Below this many completions, percentages are too noisy to be worth showing. */
export const MIN_COMPLETIONS_FOR_SHARE = 100;

export interface ShareSummary {
  /** Other people whose quiz ended on the same animal. */
  sameAnimal: number;
  /** Other people who have completed the quiz. */
  others: number;
  /** sameAnimal / others, or null when nobody else has taken the quiz yet. */
  share: number | null;
  /** Only once there are enough completions for a percentage to mean something. */
  showPercent: boolean;
  rarity: 'rare' | 'typical' | 'common' | null;
}

/**
 * How many *other* people's completions ended on the same animal.
 * The user's own completion is already in the counts, so it is removed.
 */
export function summarizeShare(stats: AnimalStats, animalsInQuiz: number): ShareSummary {
  const others = Math.max(0, stats.total - 1);
  const sameAnimal = Math.min(others, Math.max(0, stats.animalCount - 1));
  const share = others > 0 ? sameAnimal / others : null;
  const showPercent = share !== null && stats.total >= MIN_COMPLETIONS_FOR_SHARE;

  let rarity: ShareSummary['rarity'] = null;
  if (showPercent && share !== null) {
    const evenSplit = 1 / animalsInQuiz;
    rarity = share < evenSplit * 0.6 ? 'rare' : share > evenSplit * 2 ? 'common' : 'typical';
  }
  return { sameAnimal, others, share, showPercent, rarity };
}

export function formatShare(share: number): string {
  const percent = share * 100;
  if (percent < 1) return 'less than 1%';
  if (percent < 10) return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  return `${Math.round(percent)}%`;
}
