import { Redis } from '@upstash/redis';
// Explicit .js extensions: Vercel runs this file as native ES modules, which require them.
import { ANIMALS } from '../src/data/animals.js';
import {
  createStatsHandlers,
  findRedisCredentials,
  STATS_KEYS,
  type StatsStore,
} from '../src/lib/statsService.js';

/**
 * Vercel function at /api/stats.
 *   GET                 → { total }
 *   GET ?animal=<id>    → { total, animalCount }
 *   POST { animalId }   → records a completed quiz, returns { total, animalCount }
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
    recordCompletion: async (animalId) => {
      const [total, animalCount] = await redis
        .pipeline()
        .incr(STATS_KEYS.total)
        .hincrby(STATS_KEYS.byAnimal, animalId, 1)
        .exec<[number, number]>();
      return { total, animalCount };
    },
  };
}

const handlers = createStatsHandlers(redisStore(), new Set(ANIMALS.map((a) => a.id)));

export const GET = handlers.GET;
export const POST = handlers.POST;
