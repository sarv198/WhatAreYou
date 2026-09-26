/**
 * Downloads how often each answer option has been chosen in completed quizzes,
 * so `npm run balance -- --answers scripts/data/answer-stats.json` can tune
 * against how real people answer instead of random clicking.
 *
 * Needs the database credentials locally. Pull them from Vercel first:
 *   npx vercel env pull .env.local
 * then run:
 *   npm run export-answers
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';
import { findRedisCredentials, STATS_KEYS } from '../src/lib/statsService';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present; that's fine.
  }
}

const credentials = findRedisCredentials(process.env);
if (!credentials) {
  console.error('No database credentials found. Run `npx vercel env pull .env.local` first.');
  process.exit(1);
}

const redis = new Redis(credentials);
const [completions, counts, logLength] = await Promise.all([
  redis.get<number>(STATS_KEYS.total),
  redis.hgetall<Record<string, number>>(STATS_KEYS.answerCounts),
  redis.llen(STATS_KEYS.answerLog),
]);

const options: Record<string, Record<string, number>> = {};
for (const [key, value] of Object.entries(counts ?? {})) {
  const [questionId, optionId] = key.split(':');
  if (!questionId || !optionId) continue;
  (options[questionId] ??= {})[optionId] = Number(value);
}

const out = {
  exportedAt: new Date().toISOString(),
  completions: Number(completions ?? 0),
  answerSetsLogged: logLength,
  options,
};
mkdirSync('scripts/data', { recursive: true });
writeFileSync('scripts/data/answer-stats.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `Exported answer counts from ${out.completions} completions (${logLength} answer sets logged) ` +
    'to scripts/data/answer-stats.json',
);
