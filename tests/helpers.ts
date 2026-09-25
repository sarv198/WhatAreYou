import { ANIMALS } from '../src/data/animals';
import { evaluateQuiz, type QuizEvaluation } from '../src/lib/adaptiveQuiz';
import type { QuizContext } from '../src/lib/context';
import type { AnimalProfile, Answer } from '../src/types';

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs a full adaptive quiz, answering each question with `pick`. */
export function runQuiz(
  ctx: QuizContext,
  pick: (questionId: string, answers: Answer[]) => string,
): { answers: Answer[]; evaluation: QuizEvaluation } {
  const answers: Answer[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const evaluation = evaluateQuiz(ctx, answers);
    if (evaluation.done) return { answers, evaluation };
    const questionId = evaluation.next!.question.id;
    answers.push({ questionId, optionId: pick(questionId, answers) });
  }
  throw new Error('Quiz did not terminate');
}

/** Answers every question the way the given animal most likely would. */
export function personaPicker(ctx: QuizContext, animalId: string) {
  const index = ctx.animals.findIndex((a) => a.id === animalId);
  if (index < 0) throw new Error(`Unknown animal ${animalId}`);
  return (questionId: string) => {
    const probs = ctx.likelihoods.get(questionId)![index]!;
    return ctx.questionsById.get(questionId)!.options[probs.indexOf(Math.max(...probs))]!.id;
  };
}

export function randomPicker(ctx: QuizContext, seed: number) {
  const rand = mulberry32(seed);
  return (questionId: string) => {
    const options = ctx.questionsById.get(questionId)!.options;
    return options[Math.floor(rand() * options.length)]!.id;
  };
}

export const SNOW_LEOPARD: AnimalProfile = {
  id: 'snow-leopard',
  name: 'Snow Leopard',
  emoji: '🐆',
  animalClass: 'mammal',
  tagline: 'The Ghost of the Mountains',
  color: '#b9c2c9',
  description: 'You are elusive, self-reliant and at home where others struggle.',
  traits: ['Elusive', 'Self-reliant', 'Calm'],
  strengths: ['Stealth', 'Endurance', 'Composure'],
  funFact: 'Snow leopards can’t roar.',
  profile: {
    habitat: { snow: 1, grassland: 0.2 },
    rhythm: { morning: 0.7, evening: 0.9, night: 0.3, afternoon: 0.1 },
    lifestyle: { roaming: 0.9, hunter: 0.9, homebody: 0.2, restless: 0.3, appetite: 0.4 },
    social: { independence: 1, territorial: 0.4, family: 0.4, gregarious: 0, pack: 0, pairBond: 0.1, easygoing: 0.2 },
    mind: { patience: 0.9, precision: 0.8, intellect: 0.5, curiosity: 0.4, cunning: 0.5, creativity: 0.3 },
    temperament: { reserve: 1, calm: 0.9, confidence: 0.7, aggression: 0.2, playfulness: 0.3, chaos: 0.1, ambition: 0.3, persistence: 0.7, leadership: 0.2, loyalty: 0.3 },
    defense: { hide: 0.8, assess: 0.7, flee: 0.6, standGround: 0.3, intimidate: 0.2, exploit: 0.4 },
    gifts: { camouflage: 1, endurance: 0.8, adaptability: 0.6, strength: 0.6, speed: 0.5, flight: 0 },
    drive: { aesthetic: 0.7, industrious: 0.1 },
  },
};

export function cloneAnimal(base: AnimalProfile, overrides: Partial<AnimalProfile>): AnimalProfile {
  return { ...structuredClone(base), ...overrides };
}

export { ANIMALS };
