import { Redis } from '@upstash/redis';
import { ANIMALS } from '../src/data/animals';
import { createStatsHandlers, STATS_KEYS, type StatsStore } from '../src/lib/statsService';

/**
 * Vercel function at /api/stats.
 *   GET                 → { total }
 *   GET ?animal=<id>    → { total, animalCount }
 *   POST { animalId }   → records a completed quiz, returns { total, animalCount }
 *
 * Needs an Upstash Redis database connected to the Vercel project. The
 * marketplace integration provides KV_REST_API_*; a manual setup may use
 * UPSTASH_REDIS_REST_*. Either works.
 */
function redisStore(): StatsStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
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
