import type { TraitId, TraitProfile } from './data/traits';

export type AnimalClass = 'reptile' | 'amphibian' | 'bird' | 'mammal' | 'fish' | 'invertebrate';

export interface AnimalProfile {
  id: string;
  name: string;
  emoji: string;
  animalClass: AnimalClass;
  /** Short title shown under the name, e.g. "The Eight-Armed Genius". */
  tagline: string;
  /** Second-person portrait: "You're the kind of person who…" */
  description: string;
  /** 3–5 personality traits displayed on the result card. */
  traits: string[];
  strengths: string[];
  funFact: string;
  /** Accent colour used to theme the result screen. */
  color: string;
  /** Wikipedia article title, used to fetch a photo. Optional. */
  wikiTitle?: string;
  /** Trait values in [0, 1]. Omitted traits use the group default from the trait registry. */
  profile: TraitProfile;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export type QuestionPhase = 'broad' | 'adaptive';

export interface Question {
  id: string;
  prompt: string;
  /** Small line of flavour copy shown under the prompt. */
  kicker?: string;
  /**
   * Broad questions are always asked first, in `order`.
   * Adaptive questions are chosen at runtime by expected information gain.
   */
  phase: QuestionPhase;
  order?: number;
  /** Relative influence of this question's answers on the user profile. */
  weight: number;
  options: QuestionOption[];
}

/** Signed trait effects in [−1, 1]: +1 = "strongly this", −1 = "strongly not this". */
export type TraitEffects = Partial<Record<TraitId, number>>;

/** questionId → optionId → effects */
export type TraitMappings = Record<string, Record<string, TraitEffects>>;

export interface Answer {
  questionId: string;
  optionId: string;
}
