import type { EngineConfig } from '../lib/config';
import type { AnimalProfile, Question, TraitMappings } from '../types';
import { ANIMALS } from './animals';
import { ANIMAL_BALANCE } from './balance';
import { PREHISTORIC_ANIMALS } from './prehistoric/animals';
import { PREHISTORIC_BALANCE } from './prehistoric/balance';
import { PREHISTORIC_QUESTIONS } from './prehistoric/questions';
import { PREHISTORIC_TRAIT_MAPPINGS } from './prehistoric/traitMappings';
import { QUESTIONS } from './questions';
import { TRAIT_MAPPINGS } from './traitMappings';

export type QuizId = 'animals' | 'prehistoric';

export interface QuizData {
  id: QuizId;
  animals: AnimalProfile[];
  questions: Question[];
  mappings: TraitMappings;
  balance: Record<string, number>;
  config?: Partial<EngineConfig>;
  /** Where `npm run balance` writes this quiz's offsets, and the export name it uses. */
  balanceFile: { path: string; exportName: string };
  /** Balancing aims for no animal above `target` of a habitat's results; up to `cap` is acceptable. */
  balanceTarget: { target: number; cap: number };
}

export const QUIZ_DATA: Record<QuizId, QuizData> = {
  animals: {
    id: 'animals',
    animals: ANIMALS,
    questions: QUESTIONS,
    mappings: TRAIT_MAPPINGS,
    balance: ANIMAL_BALANCE,
    balanceFile: { path: 'src/data/balance.ts', exportName: 'ANIMAL_BALANCE' },
    balanceTarget: { target: 0.08, cap: 0.12 },
  },
  prehistoric: {
    id: 'prehistoric',
    animals: PREHISTORIC_ANIMALS,
    questions: PREHISTORIC_QUESTIONS,
    mappings: PREHISTORIC_TRAIT_MAPPINGS,
    balance: PREHISTORIC_BALANCE,
    // Ten questions in total, so a shorter quiz: three broad questions, then adaptive.
    config: { minQuestions: 7, maxQuestions: 10 },
    balanceFile: { path: 'src/data/prehistoric/balance.ts', exportName: 'PREHISTORIC_BALANCE' },
    // Half as many animals per habitat as the main quiz, so the fair share is higher.
    balanceTarget: { target: 0.12, cap: 0.16 },
  },
};

export const QUIZ_IDS = Object.keys(QUIZ_DATA) as QuizId[];

export function isQuizId(value: unknown): value is QuizId {
  return typeof value === 'string' && Object.hasOwn(QUIZ_DATA, value);
}
