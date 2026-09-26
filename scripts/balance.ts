/**
 * Calibrates per-animal offsets so no animal takes more than CAP of the results
 * within any habitat, for simulated users answering at random. Writes
 * src/data/balance.ts. Run with `npm run balance` after changing animals.
 *
 * Every round also checks that each animal still wins when answering exactly
 * as that animal would; an animal that stops winning has its offset relaxed.
 * The final report uses a fresh random sample that was not used for tuning.
 *
 * With `--answers scripts/data/answer-stats.json` (from `npm run export-answers`),
 * simulated users pick each option as often as real quiz takers do, instead of
 * uniformly at random.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateQuiz } from '../src/lib/adaptiveQuiz';
import { createQuizContext, MAX_BALANCE_OFFSET, type QuizContext } from '../src/lib/context';
import type { Answer } from '../src/types';

const CAP = 0.1;
const TARGET = 0.08;
const TUNING_USERS_PER_HABITAT = 400;
const REPORT_USERS_PER_HABITAT = 1500;
const MAX_ROUNDS = 40;
const STEP = 0.012;
/** Animals that can't win as themselves may get a small boost, never more than this. */
const MAX_BOOST = 0.05;

/** Real answer popularity, if provided: questionId → optionId → times chosen. */
const answersArg = process.argv.indexOf('--answers');
const answerCounts: Record<string, Record<string, number>> =
  answersArg > -1 ? JSON.parse(readFileSync(process.argv[answersArg + 1]!, 'utf8')).options : {};
if (answersArg > -1) console.log(`Using real answer popularity from ${process.argv[answersArg + 1]}`);

/** Picks an option at random, weighted by real popularity (+1 smoothing) when known. */
function pickOption(ctx: QuizContext, questionId: string, rand: () => number): string {
  const options = ctx.questionsById.get(questionId)!.options;
  const counts = answerCounts[questionId];
  if (!counts) return options[Math.floor(rand() * options.length)]!.id;
  const weights = options.map((o) => (counts[o.id] ?? 0) + 1);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return options[i]!.id;
  }
  return options[options.length - 1]!.id;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runQuiz(ctx: QuizContext, pick: (questionId: string) => string): number {
  const answers: Answer[] = [];
  for (;;) {
    const ev = evaluateQuiz(ctx, answers);
    if (ev.done) return ev.scores.ranked[0]!.index;
    const q = ev.next!.question;
    answers.push({ questionId: q.id, optionId: pick(q.id) });
  }
}

/** shares[habitatOption][animalIndex] for random users who picked that habitat. */
function habitatShares(ctx: QuizContext, usersPerHabitat: number, seed: number): Map<string, number[]> {
  const habitat = ctx.broadQuestions[0]!;
  const result = new Map<string, number[]>();
  habitat.options.forEach((option, h) => {
    const rand = mulberry32(seed + h * 7919);
    const wins = new Array<number>(ctx.animals.length).fill(0);
    for (let u = 0; u < usersPerHabitat; u++) {
      const winner = runQuiz(ctx, (qid) => (qid === habitat.id ? option.id : pickOption(ctx, qid, rand)));
      wins[winner]!++;
    }
    result.set(option.id, wins.map((w) => w / usersPerHabitat));
  });
  return result;
}

function personaFailures(ctx: QuizContext): number[] {
  const failures: number[] = [];
  ctx.animals.forEach((_, a) => {
    const winner = runQuiz(ctx, (qid) => {
      const probs = ctx.likelihoods.get(qid)![a]!;
      return ctx.questionsById.get(qid)!.options[probs.indexOf(Math.max(...probs))]!.id;
    });
    if (winner !== a) failures.push(a);
  });
  return failures;
}

const worstShare = (shares: Map<string, number[]>, a: number) =>
  Math.max(...[...shares.values()].map((s) => s[a]!));

const baseCtx = createQuizContext({ balance: {} });
const ids = baseCtx.animals.map((a) => a.id);
const offsets = new Array<number>(ids.length).fill(0);
/** Lowest offset an animal may reach before its own persona stops winning. */
const floors = new Array<number>(ids.length).fill(-MAX_BALANCE_OFFSET);
const toRecord = () => Object.fromEntries(ids.map((id, i) => [id, offsets[i]!]));

for (let round = 1; round <= MAX_ROUNDS; round++) {
  const ctx = createQuizContext({ balance: toRecord() });
  const shares = habitatShares(ctx, TUNING_USERS_PER_HABITAT, 1000);
  const over = ids.map((_, a) => a).filter((a) => worstShare(shares, a) > TARGET);

  const failed = personaFailures(ctx);
  for (const a of failed) {
    // Relax any penalty first; if there is none, give a small boost so every animal stays winnable.
    offsets[a] = offsets[a]! < 0 ? Math.min(0, offsets[a]! + STEP) : Math.min(MAX_BOOST, offsets[a]! + STEP / 2);
    floors[a] = offsets[a]!;
  }

  const worst = Math.max(...ids.map((_, a) => worstShare(shares, a)));
  console.log(
    `round ${String(round).padStart(2)}: worst share ${(worst * 100).toFixed(1)}%, ` +
      `${over.length} over target, ${failed.length} persona failures`,
  );
  if (over.length === 0 && failed.length === 0) break;

  for (const a of over) {
    const excess = Math.log(worstShare(shares, a) / TARGET);
    offsets[a] = Math.max(floors[a]!, offsets[a]! - STEP * Math.min(2, 0.5 + excess));
  }
}

const rounded = Object.fromEntries(
  ids.map((id, i) => [id, Math.round(offsets[i]! * 1000) / 1000]).filter(([, v]) => v !== 0),
);
writeFileSync(
  'src/data/balance.ts',
  `/**
 * Per-animal calibration offsets, added to compatibility (0–1 scale).
 * Generated by \`npm run balance\`; do not edit by hand. Animals missing
 * from this list use 0. Re-run the script after adding or changing animals.
 */
export const ANIMAL_BALANCE: Record<string, number> = ${JSON.stringify(rounded, null, 2).replace(/"([a-z0-9-]+)":/g, "'$1':")};
`,
);

// Independent check on a fresh sample.
const finalCtx = createQuizContext({ balance: rounded });
const report = habitatShares(finalCtx, REPORT_USERS_PER_HABITAT, 424242);
console.log('\nFresh sample, top results per habitat:');
let passed = true;
for (const [habitat, shares] of report) {
  const top = shares
    .map((s, a) => ({ name: finalCtx.animals[a]!.name, s }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 5);
  if (top[0]!.s > CAP) passed = false;
  console.log(`  ${habitat.padEnd(11)} ${top.map((t) => `${t.name} ${(t.s * 100).toFixed(1)}%`).join(', ')}`);
}
const failures = personaFailures(finalCtx);
console.log(`\nWrote ${Object.keys(rounded).length} offsets to src/data/balance.ts`);
console.log(`Cap of ${CAP * 100}% ${passed ? 'met' : 'NOT met'} on fresh sample; persona failures: ${failures.length}`);
