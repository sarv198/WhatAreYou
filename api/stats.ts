import { Redis } from '@upstash/redis';
// Explicit .js extensions: Vercel runs this file as native ES modules, which require them.
import { ANIMALS } from '../src/data/animals.js';
import { QUESTIONS } from '../src/data/questions.js';
import {
  ANSWER_LOG_LIMIT,
  answerLogEntry,
  buildCatalog,
  createStatsHandlers,
  findRedisCredentials,
  STATS_KEYS,
  type StatsStore,
} from '../src/lib/statsService.js';

/**
 * Vercel function at /api/stats.
 *   GET                          → { total }
 *   GET ?animal=<id>             → { total, animalCount }
 *   POST { animalId, answers? }  → records a completed quiz, returns { total, animalCount }
 *
 * Needs an Upstash Redis database connected to the Vercel project; see
 * findRedisCredentials for the environment variable names it accepts.
 */
function redisStore(): StatsStore | null {
  const credentials = findRedisCredentials(process.env);
  if (!credentials) return null;

  const redis = new Redis(credentials);
  return {
    getTotal: async () => Number((await redis.get<number>(STATS_KEYS.total)) ?? 0),
    getAnimalStats: async (animalId) => {
      const [total, animalCount] = await redis
        .pipeline()
        .get<number>(STATS_KEYS.total)
        .hget<number>(STATS_KEYS.byAnimal, animalId)
        .exec<[number | null, number | null]>();
      return { total: Number(total ?? 0), animalCount: Number(animalCount ?? 0) };
    },
    recordCompletion: async (animalId, answers) => {
      const pipeline = redis.pipeline().incr(STATS_KEYS.total).hincrby(STATS_KEYS.byAnimal, animalId, 1);
      if (answers) {
        for (const [q, o] of answers) pipeline.hincrby(STATS_KEYS.answerCounts, `${q}:${o}`, 1);
        pipeline
          .lpush(STATS_KEYS.answerLog, JSON.stringify(answerLogEntry(animalId, answers)))
          .ltrim(STATS_KEYS.answerLog, 0, ANSWER_LOG_LIMIT - 1);
      }
      const [total, animalCount] = (await pipeline.exec()) as [number, number, ...unknown[]];
      return { total, animalCount };
    },
  };
}

const handlers = createStatsHandlers(redisStore(), buildCatalog(ANIMALS, QUESTIONS));

export const GET = handlers.GET;
export const POST = handlers.POST;
