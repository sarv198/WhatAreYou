import { useCallback, useEffect, useState } from 'react';
import type { QuizId } from '../data/quizzes';
import type { AnimalStats } from '../lib/statsService';
import { claimRunCompletion, fetchAnimalStats, fetchQuizCount, recordQuizCompletion } from '../lib/statsClient';
import type { Answer } from '../types';

export interface RecordedCompletion {
  animalId: string;
  stats: AnimalStats;
}

/** A quiz's "quiz takers" tally. `count` stays null when the counter is unavailable. */
export function useQuizCount(quiz: QuizId) {
  const [count, setCount] = useState<number | null>(null);
  const [lastRecorded, setLastRecorded] = useState<RecordedCompletion | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchQuizCount(quiz, controller.signal).then((total) => {
      if (total !== null) setCount(total);
    });
    return () => controller.abort();
  }, [quiz]);

  const recordCompletion = useCallback(
    async (animalId: string, answers: readonly Answer[]) => {
      if (!claimRunCompletion(quiz)) return;
      const stats = await recordQuizCompletion(quiz, animalId, answers);
      if (!stats) return;
      setCount(stats.total);
      setLastRecorded({ animalId, stats });
    },
    [quiz],
  );

  return { count, lastRecorded, recordCompletion };
}

/**
 * How many completions ended on this animal. Uses the numbers returned when
 * this very result was recorded if available, otherwise asks the server
 * (e.g. when revisiting a saved result).
 */
export function useAnimalStats(
  quiz: QuizId,
  animalId: string,
  recorded: RecordedCompletion | null,
): AnimalStats | null {
  const [fetched, setFetched] = useState<{ animalId: string; stats: AnimalStats } | null>(null);
  const known = recorded?.animalId === animalId ? recorded.stats : null;

  useEffect(() => {
    if (known) return;
    const controller = new AbortController();
    fetchAnimalStats(quiz, animalId, controller.signal).then((stats) => {
      if (stats) setFetched({ animalId, stats });
    });
    return () => controller.abort();
  }, [quiz, animalId, known]);

  return known ?? (fetched?.animalId === animalId ? fetched.stats : null);
}
