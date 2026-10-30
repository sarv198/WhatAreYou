/** Runs one slice of a balancing round in its own process; see scripts/balance.ts. */
import { readFileSync } from 'node:fs';
import type { QuizId } from '../src/data/quizzes';
import { createContextFor } from '../src/lib/quizContexts';
import { personaFailures, simulateHabitat, type AnswerCounts } from './balance-sim';

type Job =
  | {
      kind: 'habitat';
      quiz: QuizId;
      balance: Record<string, number>;
      habitat: string;
      users: number;
      seed: number;
      startIndex: number;
      answerCounts: AnswerCounts;
    }
  | { kind: 'persona'; quiz: QuizId; balance: Record<string, number>; indices: number[] };

const job = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Job;
const ctx = createContextFor(job.quiz, job.balance);
const result =
  job.kind === 'habitat'
    ? simulateHabitat(ctx, job.habitat, job.users, job.seed, job.startIndex, job.answerCounts)
    : personaFailures(ctx, job.indices);
process.stdout.write(`\nRESULT ${JSON.stringify(result)}\n`);
