/**
 * Calibrates per-animal offsets so no animal takes much more than 10% (at most
 * CAP) of the results within any habitat. Writes src/data/balance.ts.
 * Run with `npm run balance` after changing animals.
 *
 * Every round also checks that each animal still wins when answering exactly
 * as that animal would; an animal that stops winning has its offset relaxed.
 * The final report uses a fresh random sample that was not used for tuning.
 *
 * By default half the simulated users answer uniformly at random and half lean
 * toward flattering answers. With `--answers scripts/data/answer-stats.json`
 * (from `npm run export-answers`), they pick each option as often as real quiz
 * takers do instead.
 *
 * Each round is split across parallel worker processes (scripts/balance-worker.ts).
 * Starts from the current calibration; pass --fresh to start from zero.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { ANIMAL_BALANCE } from '../src/data/balance';
import { createQuizContext, MAX_BALANCE_OFFSET } from '../src/lib/context';
import type { AnswerCounts } from './balance-sim';

/** Aim for no animal above 10% of a habitat's results; up to CAP is acceptable. */
const CAP = 0.12;
const TARGET = 0.08;
const TUNING_USERS_PER_HABITAT = 400;
const REPORT_USERS_PER_HABITAT = 1500;
const MAX_ROUNDS = 40;
const STEP = 0.012;
/** Animals that can't win as themselves may get a small boost, never more than this. */
const MAX_BOOST = 0.05;

const answersArg = process.argv.indexOf('--answers');
const answerCounts: AnswerCounts =
  answersArg > -1 ? JSON.parse(readFileSync(process.argv[answersArg + 1]!, 'utf8')).options : {};
if (answersArg > -1) console.log(`Using real answer popularity from ${process.argv[answersArg + 1]}`);

const workDir = mkdtempSync(join(tmpdir(), 'animal-balance-'));
let jobCounter = 0;

/** Runs one worker job in a separate process and returns its parsed result. */
function runJob<T>(job: unknown): Promise<T> {
  const file = join(workDir, `job-${jobCounter++}.json`);
  writeFileSync(file, JSON.stringify(job));
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite-node', 'scripts/balance-worker.ts', file], { shell: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) => {
      const line = out.split('\n').find((l) => l.startsWith('RESULT '));
      if (code === 0 && line) resolve(JSON.parse(line.slice('RESULT '.length)) as T);
      else reject(new Error(`worker failed (${code}): ${err.slice(-500)}`));
    });
  });
}

const baseCtx = createQuizContext({ balance: {} });
const ids = baseCtx.animals.map((a) => a.id);
const habitatOptions = baseCtx.broadQuestions[0]!.options.map((o) => o.id);
// Enough chunks per habitat to keep the machine busy without oversubscribing it.
const chunksPerHabitat = Math.max(1, Math.floor((cpus().length - 2) / habitatOptions.length));
const personaChunks = 4;

/** shares[habitatOption][animalIndex], computed in parallel. */
async function habitatShares(balance: Record<string, number>, usersPerHabitat: number, seed: number) {
  const perChunk = Math.ceil(usersPerHabitat / chunksPerHabitat);
  const jobs = habitatOptions.flatMap((habitat, h) =>
    Array.from({ length: chunksPerHabitat }, (_, c) => ({
      habitat,
      promise: runJob<number[]>({
        kind: 'habitat',
        balance,
        habitat,
        users: Math.min(perChunk, usersPerHabitat - c * perChunk),
        seed: seed + h * 7919 + c * 104729,
        startIndex: c * perChunk,
        answerCounts,
      }),
    })),
  );
  const result = new Map<string, number[]>(habitatOptions.map((h) => [h, new Array(ids.length).fill(0)]));
  for (const { habitat, promise } of jobs) {
    const wins = await promise;
    const totals = result.get(habitat)!;
    wins.forEach((w, a) => (totals[a]! += w));
  }
  for (const totals of result.values()) totals.forEach((w, a) => (totals[a] = w / usersPerHabitat));
  return result;
}

async function personaFailures(balance: Record<string, number>): Promise<number[]> {
  const all = ids.map((_, i) => i);
  const size = Math.ceil(all.length / personaChunks);
  const parts = await Promise.all(
    Array.from({ length: personaChunks }, (_, c) =>
      runJob<number[]>({ kind: 'persona', balance, indices: all.slice(c * size, (c + 1) * size) }),
    ),
  );
  return parts.flat();
}

const worstShare = (shares: Map<string, number[]>, a: number) =>
  Math.max(...[...shares.values()].map((s) => s[a]!));

const offsets = ids.map((id) => (process.argv.includes('--fresh') ? 0 : (ANIMAL_BALANCE[id] ?? 0)));
/** Lowest offset an animal may reach before its own persona stops winning. */
const floors = new Array<number>(ids.length).fill(-MAX_BALANCE_OFFSET);
const toRecord = () => Object.fromEntries(ids.map((id, i) => [id, offsets[i]!]));

console.log(`Running ${habitatOptions.length * chunksPerHabitat + personaChunks} parallel workers per round`);
for (let round = 1; round <= MAX_ROUNDS; round++) {
  const balance = toRecord();
  const [shares, failed] = await Promise.all([
    habitatShares(balance, TUNING_USERS_PER_HABITAT, 1000),
    personaFailures(balance),
  ]);
  const over = ids.map((_, a) => a).filter((a) => worstShare(shares, a) > TARGET);

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
  // Good enough: everything within the acceptable cap and every animal winnable.
  if (worst <= CAP && failed.length === 0 && round >= 8) break;

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
const [report, failures] = await Promise.all([
  habitatShares(rounded, REPORT_USERS_PER_HABITAT, 424242),
  personaFailures(rounded),
]);
console.log('\nFresh sample, top results per habitat:');
let passed = true;
for (const [habitat, shares] of report) {
  const top = shares
    .map((s, a) => ({ name: baseCtx.animals[a]!.name, s }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 5);
  if (top[0]!.s > CAP) passed = false;
  console.log(`  ${habitat.padEnd(11)} ${top.map((t) => `${t.name} ${(t.s * 100).toFixed(1)}%`).join(', ')}`);
}
console.log(`\nWrote ${Object.keys(rounded).length} offsets to src/data/balance.ts`);
console.log(`Cap of ${CAP * 100}% ${passed ? 'met' : 'NOT met'} on fresh sample; persona failures: ${failures.length}`);
rmSync(workDir, { recursive: true, force: true });
