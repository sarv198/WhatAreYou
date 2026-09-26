import { ANIMALS } from '../data/animals';
import { ANIMAL_BALANCE } from '../data/balance';
import { QUESTIONS } from '../data/questions';
import { TRAIT_MAPPINGS } from '../data/traitMappings';
import type { AnimalProfile, Question, TraitMappings } from '../types';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { answerLikelihoods } from './informationGain';
import { toTraitVector, type TraitVector } from './scoring';
import { validateAnimalSet, validateQuestionBank } from './validation';

/**
 * Everything the engine needs, precomputed once. All engine functions are pure
 * functions of (context, answers), which keeps the classification deterministic.
 */
export interface QuizContext {
  animals: readonly AnimalProfile[];
  animalVectors: readonly TraitVector[];
  questions: readonly Question[];
  questionsById: ReadonlyMap<string, Question>;
  /** Broad-phase questions in their fixed order. */
  broadQuestions: readonly Question[];
  mappings: TraitMappings;
  config: EngineConfig;
  /** questionId → [animalIndex][optionIndex] → P(option | animal) */
  likelihoods: ReadonlyMap<string, number[][]>;
  /** Calibration offset per animal index, added to compatibility. */
  balance: readonly number[];
}

export interface QuizContextInput {
  animals?: AnimalProfile[];
  questions?: Question[];
  mappings?: TraitMappings;
  config?: Partial<EngineConfig>;
  /** animalId → compatibility offset. Defaults to the generated calibration. */
  balance?: Record<string, number>;
}

/** Offsets are small nudges; anything larger would override real personality matches. */
export const MAX_BALANCE_OFFSET = 0.15;

export function createQuizContext(input: QuizContextInput = {}): QuizContext {
  const animals = input.animals ?? ANIMALS;
  const questions = input.questions ?? QUESTIONS;
  const mappings = input.mappings ?? TRAIT_MAPPINGS;
  const config = { ...DEFAULT_CONFIG, ...input.config };
  const balanceById = input.balance ?? ANIMAL_BALANCE;

  const errors = [...validateAnimalSet(animals), ...validateQuestionBank(questions, mappings)];
  for (const [id, offset] of Object.entries(balanceById)) {
    if (!(Math.abs(offset) <= MAX_BALANCE_OFFSET)) {
      errors.push(`balance for "${id}" must be within ±${MAX_BALANCE_OFFSET}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Invalid quiz data:\n  - ${errors.join('\n  - ')}`);
  }

  const animalVectors = animals.map((a) => toTraitVector(a.profile));
  const likelihoods = new Map(
    questions.map((q) => [q.id, answerLikelihoods(q, animalVectors, mappings, config.answerSharpness)]),
  );
  const broadQuestions = questions
    .filter((q) => q.phase === 'broad')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    animals,
    animalVectors,
    questions,
    questionsById: new Map(questions.map((q) => [q.id, q])),
    broadQuestions,
    mappings,
    config,
    likelihoods,
    balance: animals.map((a) => balanceById[a.id] ?? 0),
  };
}
