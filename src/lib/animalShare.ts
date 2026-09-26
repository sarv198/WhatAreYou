import type { AnimalStats } from './statsService';

/** Below this many completions, percentages are too noisy to be worth showing. */
export const MIN_COMPLETIONS_FOR_SHARE = 100;

export type ShareSummary =
  | { kind: 'first' }
  | { kind: 'share'; share: number; rarity: 'rare' | 'typical' | 'common' };

/**
 * What share of *other* people's completions ended on the same animal.
 * The user's own completion is already in the counts, so it is removed.
 */
export function summarizeShare(stats: AnimalStats, animalsInQuiz: number): ShareSummary | null {
  if (stats.total < MIN_COMPLETIONS_FOR_SHARE) return null;
  const others = stats.total - 1;
  const sameAnimal = Math.max(0, stats.animalCount - 1);
  if (sameAnimal === 0) return { kind: 'first' };

  const share = sameAnimal / others;
  const evenSplit = 1 / animalsInQuiz;
  const rarity = share < evenSplit * 0.6 ? 'rare' : share > evenSplit * 2 ? 'common' : 'typical';
  return { kind: 'share', share, rarity };
}

export function formatShare(share: number): string {
  const percent = share * 100;
  if (percent < 1) return 'Less than 1%';
  if (percent < 10) return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  return `${Math.round(percent)}%`;
}
