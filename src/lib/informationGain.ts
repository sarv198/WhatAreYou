import type { TraitId } from '../data/traits';
import type { Question, TraitMappings } from '../types';
import type { QuizContext } from './context';
import {
  closeness,
  computeLogits,
  effectToTarget,
  entropyBits,
  softmax,
  TRAIT_INDEX,
  type ScoreSnapshot,
  type TraitVector,
} from './scoring';

/**
 * How naturally an animal "would pick" an option: the evidence-weighted
 * closeness between the option's implied traits and the animal's traits.
 */
export function optionAffinity(
  effects: Partial<Record<TraitId, number>>,
  animalVector: TraitVector,
): number {
  let sum = 0;
  let weight = 0;
  for (const [traitId, effect] of Object.entries(effects)) {
    const i = TRAIT_INDEX.get(traitId as TraitId)!;
    const w = Math.abs(effect);
    sum += w * closeness(effectToTarget(effect), animalVector[i]!);
    weight += w;
  }
  return weight > 0 ? sum / weight : 0.5;
}

/**
 * P(option | animal) for one question: a softmax over option affinities.
 * Returned as [animalIndex][optionIndex]. Static per data set, so it is
 * precomputed once in the quiz context.
 */
export function answerLikelihoods(
  question: Question,
  animalVectors: readonly TraitVector[],
  mappings: TraitMappings,
  answerSharpness: number,
): number[][] {
  return animalVectors.map((vector) =>
    softmax(
      question.options.map(
        (option) => answerSharpness * optionAffinity(mappings[question.id]?.[option.id] ?? {}, vector),
      ),
    ),
  );
}

export interface QuestionGain {
  question: Question;
  /** Expected reduction in uncertainty (bits) over the current candidate pool. */
  gain: number;
  /** Predicted chance of each option being picked, given current beliefs. */
  optionProbabilities: number[];
}

/**
 * Expected information gain of asking `question` now.
 *
 *   for each option:
 *     P(option)      = Σ_animals P(animal) · P(option | animal)
 *     posterior      = re-score the pool as if the user had picked it
 *   gain = H(pool now) − Σ P(option) · H(posterior)
 *
 * Only the current candidate pool is considered, so the selected question is
 * the one that best separates the animals still in the running.
 */
export function expectedInformationGain(
  ctx: QuizContext,
  question: Question,
  snapshot: ScoreSnapshot,
): QuestionGain {
  const pool = snapshot.pool;
  const poolMass = pool.reduce((sum, s) => sum + s.probability, 0);
  const prior = pool.map((s) => s.probability / poolMass);
  const likelihood = ctx.likelihoods.get(question.id)!;

  const optionProbabilities = question.options.map((_, o) =>
    pool.reduce((sum, s, k) => sum + prior[k]! * likelihood[s.index]![o]!, 0),
  );

  let expectedEntropy = 0;
  question.options.forEach((option, o) => {
    const pOption = optionProbabilities[o]!;
    if (pOption < 1e-12) return;
    const { logits } = computeLogits(ctx, [
      ...snapshot.answers,
      { questionId: question.id, optionId: option.id },
    ]);
    const posterior = softmax(pool.map((s) => logits[s.index]!));
    expectedEntropy += pOption * entropyBits(posterior);
  });

  return { question, gain: snapshot.poolEntropy - expectedEntropy, optionProbabilities };
}
