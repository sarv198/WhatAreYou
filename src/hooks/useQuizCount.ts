import { useCallback, useEffect, useState } from 'react';
import type { AnimalStats } from '../lib/statsService';
import type { Answer } from '../types';
import { claimRunCompletion, fetchAnimalStats, fetchQuizCount, recordQuizCompletion } from '../lib/statsClient';

export interface RecordedCompletion {
  animalId: string;
  stats: AnimalStats;
}

/** The global "quizzes taken" tally. `count` stays null when the counter is unavailable. */
export function useQuizCount() {
  const [count, setCount] = useState<number | null>(null);
  const [lastRecorded, setLastRecorded] = useState<RecordedCompletion | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchQuizCount(controller.signal).then((total) => {
      if (total !== null) setCount(total);
    });
    return () => controller.abort();
  }, []);

  const recordCompletion = useCallback(async (animalId: string, answers: readonly Answer[]) => {
    if (!claimRunCompletion()) return;
    const stats = await recordQuizCompletion(animalId, answers);
    if (!stats) return;
    setCount(stats.total);
    setLastRecorded({ animalId, stats });
  }, []);

  return { count, lastRecorded, recordCompletion };
}

/**
 * How many completions ended on this animal. Uses the numbers returned when
 * this very result was recorded if available, otherwise asks the server
 * (e.g. when revisiting a saved result).
 */
export function useAnimalStats(animalId: string, recorded: RecordedCompletion | null): AnimalStats | null {
  const [fetched, setFetched] = useState<{ animalId: string; stats: AnimalStats } | null>(null);
  const known = recorded?.animalId === animalId ? recorded.stats : null;

  useEffect(() => {
    if (known) return;
    const controller = new AbortController();
    fetchAnimalStats(animalId, controller.signal).then((stats) => {
      if (stats) setFetched({ animalId, stats });
    });
    return () => controller.abort();
  }, [animalId, known]);

  return known ?? (fetched?.animalId === animalId ? fetched.stats : null);
}
