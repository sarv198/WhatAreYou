/**
 * Offline tuning harness. Run with `npm run simulate`.
 *
 *  1. Ideal personas: for every animal, answer each question the way that animal
 *     most likely would. Every animal should win its own persona.
 *  2. Noisy personas: sample answers from P(option | animal) — how often does the
 *     "true" animal land in the top 1 / top 3?
 *  3. Random users: uniformly random answers — how evenly are results spread,
 *     and how many questions does it take?
 */
import { evaluateQuiz } from '../src/lib/adaptiveQuiz';
import { createQuizContext, type QuizContext } from '../src/lib/context';
import type { Answer } from '../src/types';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Picker = (questionId: string) => string;

function run(ctx: QuizContext, pick: Picker) {
  const answers: Answer[] = [];
  const poolSizes: number[] = [];
  for (;;) {
    const evaluation = evaluateQuiz(ctx, answers);
    poolSizes.push(evaluation.scores.pool.length);
    if (evaluation.done) return { answers, evaluation, poolSizes };
    const q = evaluation.next!.question;
    answers.push({ questionId: q.id, optionId: pick(q.id) });
  }
}

const ctx = createQuizContext();
const { animals, questionsById, likelihoods } = ctx;

// 1. Ideal personas
let reachable = 0;
const lengths: number[] = [];
console.log('\n── Ideal personas ──');
animals.forEach((animal, a) => {
  const { evaluation, answers, poolSizes } = run(ctx, (qid) => {
    const probs = likelihoods.get(qid)![a]!;
    const best = probs.indexOf(Math.max(...probs));
    return questionsById.get(qid)!.options[best]!.id;
  });
  const ranked = evaluation.scores.ranked;
  const rank = ranked.findIndex((s) => s.animal.id === animal.id) + 1;
  lengths.push(answers.length);
  if (rank === 1) reachable++;
  const flag = rank === 1 ? '  ' : '✗ ';
  console.log(
    `${flag}${animal.name.padEnd(26)} rank ${String(rank).padStart(2)}  q=${answers.length} (${evaluation.stopReason})` +
      `  top=${ranked[0]!.animal.name} ${(ranked[0]!.probability * 100).toFixed(0)}% ` +
      `strength=${Math.round(ranked[0]!.compatibility * 100)} 2nd=${ranked[1]!.animal.name} ${Math.round(ranked[1]!.compatibility * 100)}` +
      `  pools=${poolSizes.join('→')}`,
  );
});
console.log(`Reachable: ${reachable}/${animals.length}, avg questions ${(lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1)}`);

// 2. Noisy personas
const rand = mulberry32(42);
const TRIALS = 20;
let top1 = 0;
let top3 = 0;
animals.forEach((_, a) => {
  for (let t = 0; t < TRIALS; t++) {
    const { evaluation } = run(ctx, (qid) => {
      const probs = likelihoods.get(qid)![a]!;
      let r = rand();
      let i = 0;
      while (i < probs.length - 1 && (r -= probs[i]!) > 0) i++;
      return questionsById.get(qid)!.options[i]!.id;
    });
    const rank = evaluation.scores.ranked.findIndex((s) => s.index === a) + 1;
    if (rank === 1) top1++;
    if (rank <= 3) top3++;
  }
});
const n = animals.length * TRIALS;
console.log(`\n── Noisy personas ──\nTop-1 ${((top1 / n) * 100).toFixed(1)}%   Top-3 ${((top3 / n) * 100).toFixed(1)}%`);

// 3. Random users
const RANDOM_USERS = 3000;
const wins = new Map<string, number>();
const reasons = new Map<string, number>();
const randomLengths: number[] = [];
const firstPools: number[][] = [];
for (let u = 0; u < RANDOM_USERS; u++) {
  const { evaluation, answers, poolSizes } = run(ctx, (qid) => {
    const options = questionsById.get(qid)!.options;
    return options[Math.floor(rand() * options.length)]!.id;
  });
  const winner = evaluation.scores.ranked[0]!.animal.name;
  wins.set(winner, (wins.get(winner) ?? 0) + 1);
  reasons.set(evaluation.stopReason!, (reasons.get(evaluation.stopReason!) ?? 0) + 1);
  randomLengths.push(answers.length);
  firstPools.push(poolSizes);
}
const avgPool = (step: number) => {
  const vals = firstPools.map((p) => p[Math.min(step, p.length - 1)]!);
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};
console.log('\n── Random users ──');
console.log(`Avg questions ${(randomLengths.reduce((a, b) => a + b, 0) / RANDOM_USERS).toFixed(1)}  stop reasons`, Object.fromEntries(reasons));
console.log(`Avg pool size by step: ${Array.from({ length: 14 }, (_, i) => avgPool(i)).join(' → ')}`);
console.log(`Distinct winners: ${wins.size}/${animals.length}`);
const sorted = [...wins.entries()].sort((a, b) => b[1] - a[1]);
console.log(sorted.map(([name, c]) => `${name} ${((c / RANDOM_USERS) * 100).toFixed(1)}%`).join(', '));
const never = animals.filter((a) => !wins.has(a.name)).map((a) => a.name);
if (never.length) console.log(`Never won: ${never.join(', ')}`);
