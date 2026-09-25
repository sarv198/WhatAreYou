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

/** An animal that is deliberately not in the shipped data, used to test adding new ones. */
export const HONEY_BADGER: AnimalProfile = {
  id: 'honey-badger',
  name: 'Honey Badger',
  animalClass: 'mammal',
  tagline: 'The Unbothered Menace',
  color: '#5a5550',
  description: 'You are fearless, stubborn and completely unconcerned with what anyone thinks.',
  traits: ['Fearless', 'Stubborn', 'Resourceful'],
  strengths: ['Nerve', 'Grit', 'Ingenuity'],
  funFact: 'Honey badgers have loose, thick skin that lets them twist around and bite back when grabbed.',
  profile: {
    habitat: { desert: 0.8, grassland: 0.9, rainforest: 0.2 },
    rhythm: { morning: 0.3, afternoon: 0.2, evening: 0.8, night: 1 },
    lifestyle: { roaming: 0.8, hunter: 0.9, homebody: 0.2, restless: 0.8, appetite: 0.9 },
    social: { independence: 1, territorial: 0.3, family: 0.3, gregarious: 0, pack: 0, pairBond: 0.1, easygoing: 0.2 },
    mind: { cunning: 0.8, creativity: 0.8, intellect: 0.7, curiosity: 0.7, patience: 0.2, precision: 0.4 },
    temperament: { aggression: 1, confidence: 1, persistence: 1, chaos: 0.8, calm: 0.3, reserve: 0.3, playfulness: 0.4, ambition: 0.6, leadership: 0.3, loyalty: 0.2 },
    defense: { standGround: 1, intimidate: 0.8, exploit: 0.7, flee: 0, hide: 0.1, assess: 0.3 },
    gifts: { strength: 0.7, endurance: 0.9, regeneration: 0.6, adaptability: 0.8, speed: 0.4, camouflage: 0.2, flight: 0 },
    drive: { industrious: 0.5, aesthetic: 0.1 },
  },
};

export function cloneAnimal(base: AnimalProfile, overrides: Partial<AnimalProfile>): AnimalProfile {
  return { ...structuredClone(base), ...overrides };
}

export { ANIMALS };
