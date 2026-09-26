import { TRAIT_DEFINITIONS, TRAIT_IDS, type TraitId, type TraitProfile } from '../data/traits';
import type { AnimalProfile, Answer, TraitEffects } from '../types';
import type { QuizContext } from './context';

/** Dense trait vector indexed like TRAIT_IDS. */
export type TraitVector = Float64Array;

export const TRAIT_INDEX: ReadonlyMap<TraitId, number> = new Map(TRAIT_IDS.map((id, i) => [id, i]));

export function toTraitVector(profile: TraitProfile): TraitVector {
  const vector = new Float64Array(TRAIT_IDS.length);
  TRAIT_DEFINITIONS.forEach((trait, i) => {
    const group = profile[trait.group] as Record<string, number | undefined> | undefined;
    vector[i] = group?.[trait.key] ?? trait.defaultValue;
  });
  return vector;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** How close two values in [0, 1] are: 1 = identical, 0 = opposite ends. */
export function closeness(a: number, b: number): number {
  return 1 - Math.abs(a - b);
}

/** Maps a signed effect in [−1, 1] onto the 0–1 trait scale. */
export function effectToTarget(effect: number): number {
  return (1 + effect) / 2;
}

/**
 * The user's cumulative personality vector. For every trait touched by an
 * answer we keep the weighted mean direction (as a 0–1 target) and how much
 * evidence backs it. Untouched traits carry no evidence and are ignored.
 */
export interface UserProfile {
  target: TraitVector;
  evidence: TraitVector;
  totalEvidence: number;
}

export function getEffects(ctx: QuizContext, answer: Answer): TraitEffects {
  const effects = ctx.mappings[answer.questionId]?.[answer.optionId];
  if (!effects) throw new Error(`No mapping for answer ${answer.questionId}.${answer.optionId}`);
  return effects;
}

export function buildUserProfile(ctx: QuizContext, answers: readonly Answer[]): UserProfile {
  const n = TRAIT_IDS.length;
  const weightedDirection = new Float64Array(n);
  const weightTotal = new Float64Array(n);
  const evidence = new Float64Array(n);

  for (const answer of answers) {
    const question = ctx.questionsById.get(answer.questionId);
    if (!question) throw new Error(`Unknown question "${answer.questionId}"`);
    for (const [traitId, effect] of Object.entries(getEffects(ctx, answer))) {
      const i = TRAIT_INDEX.get(traitId as TraitId)!;
      weightedDirection[i]! += question.weight * effect;
      weightTotal[i]! += question.weight;
      evidence[i]! += question.weight * Math.abs(effect);
    }
  }

  const target = new Float64Array(n);
  let totalEvidence = 0;
  for (let i = 0; i < n; i++) {
    target[i] = weightTotal[i]! > 0 ? effectToTarget(weightedDirection[i]! / weightTotal[i]!) : 0.5;
    totalEvidence += evidence[i]!;
  }
  return { target, evidence, totalEvidence };
}

/**
 * Evidence-weighted similarity between the user's profile and an animal, in [0, 1].
 * Traits the user has said a lot about dominate; traits never touched don't count.
 */
export function compatibility(profile: UserProfile, animalVector: TraitVector): number {
  if (profile.totalEvidence === 0) return 0.5;
  let sum = 0;
  for (let i = 0; i < animalVector.length; i++) {
    const e = profile.evidence[i]!;
    if (e > 0) sum += e * closeness(profile.target[i]!, animalVector[i]!);
  }
  return sum / profile.totalEvidence;
}

export interface CandidateScore {
  animal: AnimalProfile;
  /** Position in the animal list, used for deterministic tie-breaking. */
  index: number;
  compatibility: number;
  logit: number;
  /** Probability-like share of belief; sums to 1 across all animals. */
  probability: number;
}

export interface ScoreSnapshot {
  answers: readonly Answer[];
  /** Every animal, best match first. Ties keep data-file order. */
  ranked: CandidateScore[];
  /** Animals still realistically in the running. */
  pool: CandidateScore[];
  /** Shannon entropy (bits) of the pool, renormalised. */
  poolEntropy: number;
  profile: UserProfile;
}

/**
 * How characteristic the user's answers are of each animal, in [0, 1].
 * For every answer: P(option | animal) relative to the animal for which that
 * option is most typical. Generalist animals that fit every option equally
 * well score low here, which keeps them from absorbing mixed answer patterns.
 */
export function distinctiveness(ctx: QuizContext, answers: readonly Answer[]): number[] {
  const totals = new Array<number>(ctx.animals.length).fill(0);
  let weightSum = 0;
  for (const answer of answers) {
    const question = ctx.questionsById.get(answer.questionId)!;
    const o = question.options.findIndex((opt) => opt.id === answer.optionId);
    const likelihood = ctx.likelihoods.get(question.id)!;
    let best = 0;
    for (const row of likelihood) best = Math.max(best, row[o]!);
    likelihood.forEach((row, a) => {
      totals[a]! += question.weight * (row[o]! / best);
    });
    weightSum += question.weight;
  }
  return totals.map((t) => (weightSum > 0 ? t / weightSum : 0.5));
}

/** Compatibility and logit for every animal, indexed like ctx.animals. */
export function computeLogits(ctx: QuizContext, answers: readonly Answer[]) {
  const profile = buildUserProfile(ctx, answers);
  const scale = ctx.config.sharpness * profile.totalEvidence;
  const mix = ctx.config.distinctivenessWeight;
  const distinct = distinctiveness(ctx, answers);
  const compat = ctx.animalVectors.map((v, a) =>
    clamp01((1 - mix) * compatibility(profile, v) + mix * distinct[a]! + ctx.balance[a]!),
  );
  const logits = compat.map((c) => scale * c);
  return { profile, compat, logits };
}

export function softmax(logits: readonly number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

export function scoreAnswers(ctx: QuizContext, answers: readonly Answer[]): ScoreSnapshot {
  const { profile, compat, logits } = computeLogits(ctx, answers);

  const scores = ctx.animals.map((animal, index) => ({
    animal,
    index,
    compatibility: compat[index]!,
    logit: logits[index]!,
    probability: 0,
  }));

  const maxLogit = Math.max(...scores.map((s) => s.logit));
  let total = 0;
  for (const s of scores) {
    s.probability = Math.exp(s.logit - maxLogit);
    total += s.probability;
  }
  for (const s of scores) s.probability /= total;

  const ranked = [...scores].sort((a, b) => b.logit - a.logit || a.index - b.index);
  const pool = ranked.filter((s) => s.logit >= maxLogit - ctx.config.poolLogitGap);
  const poolMass = pool.reduce((sum, s) => sum + s.probability, 0);
  const poolEntropy = entropyBits(pool.map((s) => s.probability / poolMass));

  return { answers, ranked, pool, poolEntropy, profile };
}

export function entropyBits(probabilities: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < probabilities.length; i++) {
    const p = probabilities[i]!;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/**
 * The playful, human-facing number shown on results. Not a probability.
 * A gentle curve lifts the mid-range so a solid match reads as one, while
 * staying monotonic so rankings and numbers always agree.
 */
export function matchStrength(score: Pick<CandidateScore, 'compatibility'>): number {
  return Math.min(99, Math.round(100 * Math.pow(score.compatibility, 0.6)));
}
