import { TRAIT_DEFINITIONS, type TraitDefinition, type TraitId } from '../data/traits';
import type { AnimalProfile, Answer, Question, QuestionOption } from '../types';
import type { QuizContext } from './context';
import { optionAffinity } from './informationGain';
import { closeness, getEffects, matchStrength, scoreAnswers, TRAIT_INDEX, type ScoreSnapshot } from './scoring';

export interface MatchSummary {
  animal: AnimalProfile;
  matchStrength: number;
  probability: number;
}

export interface KeyAnswer {
  question: Question;
  option: QuestionOption;
  /** Trait labels this answer shared with the winning animal. */
  traitLabels: string[];
  /** How much more this answer favoured the winner than the average animal. */
  impact: number;
}

export interface QuizResult {
  animal: AnimalProfile;
  matchStrength: number;
  matches: MatchSummary[];
  sharedTraits: TraitDefinition[];
  explanation: string;
  keyAnswers: KeyAnswer[];
  questionsAsked: number;
  animalsConsidered: number;
}

const MATCH_COUNT = 5;

/** Traits where the user and the animal are both strongly characterised, weighted by evidence. */
function findSharedTraits(snapshot: ScoreSnapshot, animalVector: Float64Array): TraitDefinition[] {
  const { target, evidence } = snapshot.profile;
  return TRAIT_DEFINITIONS.map((trait, i) => {
    const user = target[i]!;
    const animal = animalVector[i]!;
    const score = user >= 0.62 && animal >= 0.6 ? evidence[i]! * Math.min(user, animal) * closeness(user, animal) : 0;
    return { trait, score };
  })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((t) => t.trait);
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function buildExplanation(animal: AnimalProfile, shared: TraitDefinition[], questionsAsked: number, total: number): string {
  const personality = shared.filter((t) => t.group !== 'habitat' && t.group !== 'rhythm').slice(0, 3);
  const context = shared.find((t) => t.group === 'habitat' || t.group === 'rhythm');
  const parts: string[] = [];

  if (personality.length > 0) {
    parts.push(`Like the ${animal.name}, you have ${joinNatural(personality.map((t) => t.phrase))}.`);
  } else {
    parts.push(`Your answers lined up with the ${animal.name} more consistently than with anything else.`);
  }
  if (context) parts.push(`Add ${context.phrase} and the picture gets hard to argue with.`);
  parts.push(
    total > 1
      ? `It took ${questionsAsked} questions to narrow ${total} animals down to one.`
      : `It took ${questionsAsked} questions to confirm it.`,
  );
  return parts.join(' ');
}

function findKeyAnswers(ctx: QuizContext, answers: readonly Answer[], winnerIndex: number): KeyAnswer[] {
  const winnerVector = ctx.animalVectors[winnerIndex]!;

  return answers
    .map((answer) => {
      const question = ctx.questionsById.get(answer.questionId)!;
      const option = question.options.find((o) => o.id === answer.optionId)!;
      const effects = getEffects(ctx, answer);

      const winnerAffinity = optionAffinity(effects, winnerVector);
      const meanAffinity =
        ctx.animalVectors.reduce((sum, v) => sum + optionAffinity(effects, v), 0) / ctx.animalVectors.length;

      const traitLabels = Object.entries(effects)
        .filter(([, e]) => e > 0)
        .map(([id, e]) => {
          const trait = TRAIT_DEFINITIONS[TRAIT_INDEX.get(id as TraitId)!]!;
          return { trait, fit: e * winnerVector[TRAIT_INDEX.get(id as TraitId)!]! };
        })
        .filter((t) => t.fit >= 0.3)
        .sort((a, b) => b.fit - a.fit)
        .slice(0, 2)
        .map((t) => t.trait.label);

      return { question, option, traitLabels, impact: question.weight * (winnerAffinity - meanAffinity) };
    })
    .filter((k) => k.impact > 0 && k.traitLabels.length > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
}

export function generateResult(ctx: QuizContext, answers: readonly Answer[], scores?: ScoreSnapshot): QuizResult {
  const snapshot = scores ?? scoreAnswers(ctx, answers);
  const winner = snapshot.ranked[0]!;
  const shared = findSharedTraits(snapshot, ctx.animalVectors[winner.index]!);

  return {
    animal: winner.animal,
    matchStrength: matchStrength(winner),
    matches: snapshot.ranked.slice(0, MATCH_COUNT).map((s) => ({
      animal: s.animal,
      matchStrength: matchStrength(s),
      probability: s.probability,
    })),
    sharedTraits: shared,
    explanation: buildExplanation(winner.animal, shared, answers.length, ctx.animals.length),
    keyAnswers: findKeyAnswers(ctx, answers, winner.index),
    questionsAsked: answers.length,
    animalsConsidered: ctx.animals.length,
  };
}
