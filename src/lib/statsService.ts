/**
 * Server-side logic for the completion stats, independent of any hosting
 * platform. The Vercel function and the local dev server both plug a store
 * into these handlers. Each quiz keeps its own counts.
 */

export interface AnimalStats {
  total: number;
  animalCount: number;
}

/** One answered question, as [questionId, optionId]. Compact for storage. */
export type RecordedAnswer = [questionId: string, optionId: string];

export interface StatsStore {
  getTotal(quiz: string): Promise<number>;
  getAnimalStats(quiz: string, animalId: string): Promise<AnimalStats>;
  /**
   * Records one completed quiz: which animal it ended on and, when provided,
   * the anonymous answer choices that led there.
   */
  recordCompletion(quiz: string, animalId: string, answers: RecordedAnswer[] | null): Promise<AnimalStats>;
}

/** The original quiz; requests that don't name a quiz refer to it. */
export const DEFAULT_QUIZ = 'animals';

/**
 * Redis keys for one quiz. The original quiz keeps its historical "quiz:" keys
 * so existing counts carry over; other quizzes are namespaced by their id.
 */
export function statsKeys(quiz: string) {
  const prefix = quiz === DEFAULT_QUIZ ? 'quiz' : quiz;
  return {
    total: `${prefix}:completions`,
    byAnimal: `${prefix}:completions:by-animal`,
    /** Hash of "questionId:optionId" → times chosen in a completed quiz. */
    answerCounts: `${prefix}:answers:counts`,
    /** List of recent completed answer sets (JSON), newest first, capped. */
    answerLog: `${prefix}:answers:log`,
  };
}

/** How many recent completed answer sets to keep in the log, per quiz. */
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

/** quizId → what's valid in that quiz. */
export type StatsCatalogs = Record<string, StatsCatalog>;

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

export function createStatsHandlers(store: StatsStore | null, catalogs: StatsCatalogs) {
  const unavailable = () => json({ error: 'Stats storage is not configured' }, { status: 503 });
  const badRequest = (error: string) => json({ error }, { status: 400 });
  const resolveQuiz = (raw: unknown) => {
    const quiz = raw === undefined || raw === null || raw === '' ? DEFAULT_QUIZ : raw;
    return typeof quiz === 'string' && Object.hasOwn(catalogs, quiz) ? quiz : null;
  };

  return {
    /**
     * GET /api/stats[?quiz=id] → { total }
     * GET /api/stats?animal=id[&quiz=id] → { total, animalCount }
     */
    async GET(request: Request): Promise<Response> {
      if (!store) return unavailable();
      const params = new URL(request.url).searchParams;
      const quiz = resolveQuiz(params.get('quiz'));
      if (!quiz) return badRequest('Unknown quiz');
      const animalId = params.get('animal');
      if (animalId !== null && !catalogs[quiz]!.animalIds.has(animalId)) return badRequest('Unknown animal');

      const body = animalId ? await store.getAnimalStats(quiz, animalId) : { total: await store.getTotal(quiz) };
      // Browsers always revalidate; only Vercel's edge briefly caches, to spare the database.
      return json(body, {
        headers: {
          'Cache-Control': 'no-cache',
          'CDN-Cache-Control': 'max-age=10, stale-while-revalidate=60',
        },
      });
    },

    /** POST /api/stats { quiz?, animalId, answers? } → { total, animalCount } */
    async POST(request: Request): Promise<Response> {
      if (!store) return unavailable();
      let body: { quiz?: unknown; animalId?: unknown; answers?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return badRequest('Expected a JSON body');
      }
      if (typeof body !== 'object' || body === null) return badRequest('Expected a JSON object');
      const quiz = resolveQuiz(body.quiz);
      if (!quiz) return badRequest('Unknown quiz');
      const catalog = catalogs[quiz]!;
      if (typeof body.animalId !== 'string' || !catalog.animalIds.has(body.animalId)) {
        return badRequest('Unknown animal');
      }
      const answers = parseAnswers(body.answers, catalog);
      if (answers === 'invalid') return badRequest('Invalid answers');

      const stats = await store.recordCompletion(quiz, body.animalId, answers);
      return json(stats, { headers: { 'Cache-Control': 'no-store' } });
    },
  };
}

/** In-memory store for local development and tests. Seed is quiz → animal → count. */
export function createMemoryStore(seed: Record<string, Record<string, number>> = {}) {
  const byAnimal = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const answerCounts = new Map<string, Map<string, number>>();
  const answerLogs = new Map<string, AnswerLogEntry[]>();
  const getOrInit = <V>(map: Map<string, V>, key: string, init: () => V) => {
    if (!map.has(key)) map.set(key, init());
    return map.get(key)!;
  };
  for (const [quiz, counts] of Object.entries(seed)) {
    byAnimal.set(quiz, new Map(Object.entries(counts)));
    totals.set(quiz, Object.values(counts).reduce((a, b) => a + b, 0));
  }
  const statsFor = (quiz: string, animalId: string) => ({
    total: totals.get(quiz) ?? 0,
    animalCount: byAnimal.get(quiz)?.get(animalId) ?? 0,
  });

  const store: StatsStore = {
    getTotal: async (quiz) => totals.get(quiz) ?? 0,
    getAnimalStats: async (quiz, animalId) => statsFor(quiz, animalId),
    recordCompletion: async (quiz, animalId, answers) => {
      const animals = getOrInit(byAnimal, quiz, () => new Map<string, number>());
      animals.set(animalId, (animals.get(animalId) ?? 0) + 1);
      totals.set(quiz, (totals.get(quiz) ?? 0) + 1);
      if (answers) {
        const counts = getOrInit(answerCounts, quiz, () => new Map<string, number>());
        for (const [q, o] of answers) counts.set(`${q}:${o}`, (counts.get(`${q}:${o}`) ?? 0) + 1);
        const log = getOrInit(answerLogs, quiz, () => [] as AnswerLogEntry[]);
        log.unshift(answerLogEntry(animalId, answers));
        log.length = Math.min(log.length, ANSWER_LOG_LIMIT);
      }
      return statsFor(quiz, animalId);
    },
  };
  return Object.assign(store, { byAnimal, answerCounts, answerLogs });
}

/** Builds the validation catalog for one quiz from its animal and question data. */
export function buildCatalog(
  animals: readonly { id: string }[],
  questions: readonly { id: string; options: readonly { id: string }[] }[],
): StatsCatalog {
  return {
    animalIds: new Set(animals.map((a) => a.id)),
    questions: new Map(questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))])),
  };
}
