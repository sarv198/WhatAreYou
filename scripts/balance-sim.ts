/** Simulation helpers shared by the balancer and its parallel workers. */
import { evaluateQuiz } from '../src/lib/adaptiveQuiz';
import type { QuizContext } from '../src/lib/context';
import type { Answer } from '../src/types';

export type AnswerCounts = Record<string, Record<string, number>>;

/**
 * Until real answer data exists, half the simulated users lean toward the
 * answers people like to give about themselves (4x as likely), and half
 * answer uniformly. Real people sit somewhere in between.
 */
const FLATTERING: Record<string, string[]> = {
  lifestyle: ['roam', 'social', 'active'],
  sociality: ['bestFriend', 'family', 'squad'],
  rhythm: ['morning', 'afternoon', 'evening'],
  problemSolving: ['dissect', 'unconventional'],
  sports: ['team', 'gym', 'precision'],
  dailyActivity: ['exploring', 'studying', 'building'],
  arguments: ['dismantle', 'above'],
  friends: ['dependable', 'comedian', 'leader'],
  discipline: ['science', 'art', 'nature'],
  confidence: ['quiet', 'knowGood'],
  outlook: ['fascinating', 'beautiful', 'explore'],
  danger: ['assess', 'advantage', 'stand'],
  superpower: ['flight', 'speed', 'regeneration'],
  personalSpace: ['oneOrTwo', 'ownSpace'],
};
const FLATTERING_WEIGHT = 4;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks an option at random: weighted by real popularity (+1 smoothing) when
 * known, otherwise uniformly or (for "flattering" users) toward flattering answers.
 */
function pickOption(
  ctx: QuizContext,
  questionId: string,
  rand: () => number,
  flattering: boolean,
  answerCounts: AnswerCounts,
): string {
  const options = ctx.questionsById.get(questionId)!.options;
  const counts = answerCounts[questionId];
  if (!counts && !flattering) return options[Math.floor(rand() * options.length)]!.id;
  const weights = counts
    ? options.map((o) => (counts[o.id] ?? 0) + 1)
    : options.map((o) => (FLATTERING[questionId]?.includes(o.id) ? FLATTERING_WEIGHT : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return options[i]!.id;
  }
  return options[options.length - 1]!.id;
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

/** Win counts per animal index for simulated users who all picked one habitat. */
export function simulateHabitat(
  ctx: QuizContext,
  habitatOptionId: string,
  users: number,
  seed: number,
  startIndex: number,
  answerCounts: AnswerCounts,
): number[] {
  const habitat = ctx.broadQuestions[0]!;
  const rand = mulberry32(seed);
  const wins = new Array<number>(ctx.animals.length).fill(0);
  for (let u = 0; u < users; u++) {
    const flattering = (startIndex + u) % 2 === 1;
    const winner = runQuiz(ctx, (qid) =>
      qid === habitat.id ? habitatOptionId : pickOption(ctx, qid, rand, flattering, answerCounts),
    );
    wins[winner]!++;
  }
  return wins;
}

/** Indices (from the given list) of animals that don't win when answering exactly as themselves. */
export function personaFailures(ctx: QuizContext, indices: readonly number[]): number[] {
  return indices.filter((a) => {
    const winner = runQuiz(ctx, (qid) => {
      const probs = ctx.likelihoods.get(qid)![a]!;
      return ctx.questionsById.get(qid)!.options[probs.indexOf(Math.max(...probs))]!.id;
    });
    return winner !== a;
  });
}
