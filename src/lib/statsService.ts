/**
 * Server-side logic for the completion stats, independent of any hosting
 * platform. The Vercel function and the local dev server both plug a store
 * into these handlers.
 */

export interface AnimalStats {
  total: number;
  animalCount: number;
}

export interface StatsStore {
  getTotal(): Promise<number>;
  getAnimalStats(animalId: string): Promise<AnimalStats>;
  /** Records one completed quiz and which animal it ended on. */
  recordCompletion(animalId: string): Promise<AnimalStats>;
}

export const STATS_KEYS = {
  total: 'quiz:completions',
  byAnimal: 'quiz:completions:by-animal',
} as const;

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

export function createStatsHandlers(store: StatsStore | null, validAnimalIds: ReadonlySet<string>) {
  const unavailable = () => json({ error: 'Stats storage is not configured' }, { status: 503 });
  const unknownAnimal = () => json({ error: 'Unknown animal' }, { status: 400 });

  return {
    /** GET /api/stats → { total }; GET /api/stats?animal=id → { total, animalCount } */
    async GET(request: Request): Promise<Response> {
      if (!store) return unavailable();
      const animalId = new URL(request.url).searchParams.get('animal');
      if (animalId !== null && !validAnimalIds.has(animalId)) return unknownAnimal();

      const body = animalId ? await store.getAnimalStats(animalId) : { total: await store.getTotal() };
      // Browsers always revalidate; only Vercel's edge briefly caches, to spare the database.
      return json(body, {
        headers: {
          'Cache-Control': 'no-cache',
          'CDN-Cache-Control': 'max-age=10, stale-while-revalidate=60',
        },
      });
    },

    /** POST /api/stats { animalId } → { total, animalCount } */
    async POST(request: Request): Promise<Response> {
      if (!store) return unavailable();
      let animalId: unknown;
      try {
        ({ animalId } = (await request.json()) as { animalId?: unknown });
      } catch {
        return json({ error: 'Expected a JSON body' }, { status: 400 });
      }
      if (typeof animalId !== 'string' || !validAnimalIds.has(animalId)) return unknownAnimal();
      return json(await store.recordCompletion(animalId), { headers: { 'Cache-Control': 'no-store' } });
    },
  };
}

/** In-memory store for local development and tests. */
export function createMemoryStore(seed: Record<string, number> = {}): StatsStore & { byAnimal: Map<string, number> } {
  const byAnimal = new Map(Object.entries(seed));
  let total = [...byAnimal.values()].reduce((a, b) => a + b, 0);
  const statsFor = (animalId: string) => ({ total, animalCount: byAnimal.get(animalId) ?? 0 });
  return {
    byAnimal,
    getTotal: async () => total,
    getAnimalStats: async (animalId) => statsFor(animalId),
    recordCompletion: async (animalId) => {
      byAnimal.set(animalId, (byAnimal.get(animalId) ?? 0) + 1);
      total++;
      return statsFor(animalId);
    },
  };
}
