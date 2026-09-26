import type { AnimalStats } from './statsService';

const ENDPOINT = '/api/stats';
const RUN_KEY = 'what-animal-are-you:run';

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

function toAnimalStats(data: Record<string, unknown> | null): AnimalStats | null {
  return typeof data?.total === 'number' && typeof data.animalCount === 'number'
    ? { total: data.total, animalCount: data.animalCount }
    : null;
}

/** Total completed quizzes, or null when the counter isn't available (e.g. not deployed). */
export async function fetchQuizCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const data = await readJson(await fetch(ENDPOINT, { signal, cache: 'no-cache' }));
    return typeof data?.total === 'number' ? data.total : null;
  } catch {
    return null;
  }
}

export async function fetchAnimalStats(animalId: string, signal?: AbortSignal): Promise<AnimalStats | null> {
  try {
    const url = `${ENDPOINT}?animal=${encodeURIComponent(animalId)}`;
    return toAnimalStats(await readJson(await fetch(url, { signal, cache: 'no-cache' })));
  } catch {
    return null;
  }
}

export async function recordQuizCompletion(animalId: string): Promise<AnimalStats | null> {
  try {
    return toAnimalStats(
      await readJson(
        await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animalId }),
        }),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * A "run" is one attempt at the quiz, from a fresh start to its first result.
 * Each run is counted once, so revisiting a result, reloading, or going back
 * to tweak an answer doesn't inflate the total.
 */
interface Run {
  id: string;
  counted: boolean;
}

function readRun(): Run | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? (JSON.parse(raw) as Run) : null;
  } catch {
    return null;
  }
}

function writeRun(run: Run) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Without storage every completion counts; acceptable for a fun tally.
  }
}

export function startNewRun() {
  writeRun({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, counted: false });
}

/** Returns true exactly once per run, and marks the run as counted. */
export function claimRunCompletion(): boolean {
  const run = readRun() ?? { id: 'legacy', counted: false };
  if (run.counted) return false;
  writeRun({ ...run, counted: true });
  return true;
}
