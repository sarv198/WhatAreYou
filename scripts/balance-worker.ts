/** Runs one slice of a balancing round in its own process; see scripts/balance.ts. */
import { readFileSync } from 'node:fs';
import { createQuizContext } from '../src/lib/context';
import { personaFailures, simulateHabitat, type AnswerCounts } from './balance-sim';

type Job =
  | {
      kind: 'habitat';
      balance: Record<string, number>;
      habitat: string;
      users: number;
      seed: number;
      startIndex: number;
      answerCounts: AnswerCounts;
    }
  | { kind: 'persona'; balance: Record<string, number>; indices: number[] };

const job = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Job;
const ctx = createQuizContext({ balance: job.balance });
const result =
  job.kind === 'habitat'
    ? simulateHabitat(ctx, job.habitat, job.users, job.seed, job.startIndex, job.answerCounts)
    : personaFailures(ctx, job.indices);
process.stdout.write(`\nRESULT ${JSON.stringify(result)}\n`);
