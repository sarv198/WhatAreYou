/**
 * Downloads how often each answer option has been chosen in completed quizzes,
 * so the balancer can tune against how real people answer instead of random
 * clicking.
 *
 * Needs the database credentials locally. Pull them from Vercel first:
 *   npx vercel env pull .env.local
 * then run (add `-- --quiz prehistoric` for the prehistoric quiz):
 *   npm run export-answers
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';
import { isQuizId } from '../src/data/quizzes';
import { findRedisCredentials, statsKeys } from '../src/lib/statsService';

const quizArg = process.argv.indexOf('--quiz');
const quiz = quizArg > -1 ? process.argv[quizArg + 1]! : 'animals';
if (!isQuizId(quiz)) {
  console.error(`Unknown quiz "${quiz}"`);
  process.exit(1);
}

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

const keys = statsKeys(quiz);
const redis = new Redis(credentials);
const [completions, counts, logLength] = await Promise.all([
  redis.get<number>(keys.total),
  redis.hgetall<Record<string, number>>(keys.answerCounts),
  redis.llen(keys.answerLog),
]);

const options: Record<string, Record<string, number>> = {};
for (const [key, value] of Object.entries(counts ?? {})) {
  const [questionId, optionId] = key.split(':');
  if (!questionId || !optionId) continue;
  (options[questionId] ??= {})[optionId] = Number(value);
}

const out = {
  quiz,
  exportedAt: new Date().toISOString(),
  completions: Number(completions ?? 0),
  answerSetsLogged: logLength,
  options,
};
const file = quiz === 'animals' ? 'scripts/data/answer-stats.json' : `scripts/data/answer-stats-${quiz}.json`;
mkdirSync('scripts/data', { recursive: true });
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Exported answer counts from ${out.completions} completions (${logLength} answer sets logged) to ${file}`);
