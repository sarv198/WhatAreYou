/**
 * Server-side logic for the completion stats, independent of any hosting
 * platform. The Vercel function and the local dev server both plug a store
 * into these handlers.
 */

export interface AnimalStats {
  total: number;
  animalCount: number;
}

/** One answered question, as [questionId, optionId]. Compact for storage. */
export type RecordedAnswer = [questionId: string, optionId: string];

export interface StatsStore {
  getTotal(): Promise<number>;
  getAnimalStats(animalId: string): Promise<AnimalStats>;
  /**
   * Records one completed quiz: which animal it ended on and, when provided,
   * the anonymous answer choices that led there.
   */
  recordCompletion(animalId: string, answers: RecordedAnswer[] | null): Promise<AnimalStats>;
}

export const STATS_KEYS = {
  total: 'quiz:completions',
  byAnimal: 'quiz:completions:by-animal',
  /** Hash of "questionId:optionId" → times chosen in a completed quiz. */
  answerCounts: 'quiz:answers:counts',
  /** List of recent completed answer sets (JSON), newest first, capped. */
  answerLog: 'quiz:answers:log',
} as const;

/** How many recent completed answer sets to keep in the log. */
export const ANSWER_LOG_LIMIT = 10_000;

export interface AnswerLogEntry {
  /** Animal id the quiz ended on. */
  a: string;
  /** Answers in the order they were asked. */
  r: RecordedAnswer[];
  /** Day of completion (YYYY-MM-DD); deliberately coarse. */
  d: string;
}

export function answerLogEntry(animalId: string, answers: RecordedAnswer[], now = new Date()): AnswerLogEntry {
  return { a: animalId, r: answers, d: now.toISOString().slice(0, 10) };
}

/**
 * Finds the Upstash REST credentials in the environment. Vercel's storage
 * integration names them KV_REST_API_URL / KV_REST_API_TOKEN, optionally with
 * a custom prefix chosen when connecting the database (e.g.
 * "animalquiz_KV_REST_API_URL"); a manual setup uses UPSTASH_REDIS_REST_*.
 * The read-only token is never used, since recording completions needs writes.
 */
export function findRedisCredentials(env: Record<string, string | undefined>): { url: string; token: string } | null {
  const bySuffix = (suffix: string) => {
    if (env[suffix]) return env[suffix];
    const key = Object.keys(env)
      .sort()
      .find((k) => k.endsWith(`_${suffix}`) && env[k]);
    return key ? env[key] : undefined;
  };
  const url = env.UPSTASH_REDIS_REST_URL || bySuffix('KV_REST_API_URL');
  const token = env.UPSTASH_REDIS_REST_TOKEN || bySuffix('KV_REST_API_TOKEN');
  return url && token ? { url, token } : null;
}

export interface StatsCatalog {
  animalIds: ReadonlySet<string>;
  /** questionId → valid option ids */
  questions: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Validates submitted answers against the real question bank.
 * undefined (older clients that don't send answers) is allowed and yields null;
 * anything present but malformed is rejected so junk never reaches storage.
 */
export function parseAnswers(raw: unknown, catalog: StatsCatalog): RecordedAnswer[] | null | 'invalid' {
  if (raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > catalog.questions.size) return 'invalid';
  const seen = new Set<string>();
  const answers: RecordedAnswer[] = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length !== 2) return 'invalid';
    const [questionId, optionId] = item as unknown[];
    if (typeof questionId !== 'string' || typeof optionId !== 'string') return 'invalid';
    if (seen.has(questionId) || !catalog.questions.get(questionId)?.has(optionId)) return 'invalid';
    seen.add(questionId);
    answers.push([questionId, optionId]);
  }
  return answers;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

export function createStatsHandlers(store: StatsStore | null, catalog: StatsCatalog) {
  const unavailable = () => json({ error: 'Stats storage is not configured' }, { status: 503 });
  const badRequest = (error: string) => json({ error }, { status: 400 });

  return {
    /** GET /api/stats → { total }; GET /api/stats?animal=id → { total, animalCount } */
    async GET(request: Request): Promise<Response> {
      if (!store) return unavailable();
      const animalId = new URL(request.url).searchParams.get('animal');
      if (animalId !== null && !catalog.animalIds.has(animalId)) return badRequest('Unknown animal');

      const body = animalId ? await store.getAnimalStats(animalId) : { total: await store.getTotal() };
      // Browsers always revalidate; only Vercel's edge briefly caches, to spare the database.
      return json(body, {
        headers: {
          'Cache-Control': 'no-cache',
          'CDN-Cache-Control': 'max-age=10, stale-while-revalidate=60',
        },
      });
    },

    /** POST /api/stats { animalId, answers? } → { total, animalCount } */
    async POST(request: Request): Promise<Response> {
      if (!store) return unavailable();
      let body: { animalId?: unknown; answers?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return badRequest('Expected a JSON body');
      }
      if (typeof body?.animalId !== 'string' || !catalog.animalIds.has(body.animalId)) {
        return badRequest('Unknown animal');
      }
      const answers = parseAnswers(body.answers, catalog);
      if (answers === 'invalid') return badRequest('Invalid answers');

      const stats = await store.recordCompletion(body.animalId, answers);
      return json(stats, { headers: { 'Cache-Control': 'no-store' } });
    },
  };
}

/** In-memory store for local development and tests. */
export function createMemoryStore(seed: Record<string, number> = {}) {
  const byAnimal = new Map(Object.entries(seed));
  const answerCounts = new Map<string, number>();
  const answerLog: AnswerLogEntry[] = [];
  let total = [...byAnimal.values()].reduce((a, b) => a + b, 0);
  const statsFor = (animalId: string) => ({ total, animalCount: byAnimal.get(animalId) ?? 0 });

  const store: StatsStore = {
    getTotal: async () => total,
    getAnimalStats: async (animalId) => statsFor(animalId),
    recordCompletion: async (animalId, answers) => {
      byAnimal.set(animalId, (byAnimal.get(animalId) ?? 0) + 1);
      total++;
      if (answers) {
        for (const [q, o] of answers) answerCounts.set(`${q}:${o}`, (answerCounts.get(`${q}:${o}`) ?? 0) + 1);
        answerLog.unshift(answerLogEntry(animalId, answers));
        answerLog.length = Math.min(answerLog.length, ANSWER_LOG_LIMIT);
      }
      return statsFor(animalId);
    },
  };
  return Object.assign(store, { byAnimal, answerCounts, answerLog });
}

/** Builds the validation catalog from the animal and question data. */
export function buildCatalog(
  animals: readonly { id: string }[],
  questions: readonly { id: string; options: readonly { id: string }[] }[],
): StatsCatalog {
  return {
    animalIds: new Set(animals.map((a) => a.id)),
    questions: new Map(questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))])),
  };
}
