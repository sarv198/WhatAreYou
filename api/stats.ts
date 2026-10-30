import { Redis } from '@upstash/redis';
// Explicit .js extensions: Vercel runs this file as native ES modules, which require them.
import { ANIMALS } from '../src/data/animals.js';
import { PREHISTORIC_ANIMALS } from '../src/data/prehistoric/animals.js';
import { PREHISTORIC_QUESTIONS } from '../src/data/prehistoric/questions.js';
import { QUESTIONS } from '../src/data/questions.js';
import {
  ANSWER_LOG_LIMIT,
  answerLogEntry,
  buildCatalog,
  createStatsHandlers,
  findRedisCredentials,
  statsKeys,
  type StatsStore,
} from '../src/lib/statsService.js';

/**
 * Vercel function at /api/stats. Every request may name a quiz (`quiz`,
 * default "animals"); each quiz keeps its own counts.
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
    getTotal: async (quiz) => Number((await redis.get<number>(statsKeys(quiz).total)) ?? 0),
    getAnimalStats: async (quiz, animalId) => {
      const keys = statsKeys(quiz);
      const [total, animalCount] = await redis
        .pipeline()
        .get<number>(keys.total)
        .hget<number>(keys.byAnimal, animalId)
        .exec<[number | null, number | null]>();
      return { total: Number(total ?? 0), animalCount: Number(animalCount ?? 0) };
    },
    recordCompletion: async (quiz, animalId, answers) => {
      const keys = statsKeys(quiz);
      const pipeline = redis.pipeline().incr(keys.total).hincrby(keys.byAnimal, animalId, 1);
      if (answers) {
        for (const [q, o] of answers) pipeline.hincrby(keys.answerCounts, `${q}:${o}`, 1);
        pipeline
          .lpush(keys.answerLog, JSON.stringify(answerLogEntry(animalId, answers)))
          .ltrim(keys.answerLog, 0, ANSWER_LOG_LIMIT - 1);
      }
      const [total, animalCount] = (await pipeline.exec()) as [number, number, ...unknown[]];
      return { total, animalCount };
    },
  };
}

const handlers = createStatsHandlers(redisStore(), {
  animals: buildCatalog(ANIMALS, QUESTIONS),
  prehistoric: buildCatalog(PREHISTORIC_ANIMALS, PREHISTORIC_QUESTIONS),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
