import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/data/questions';
import { TRAIT_MAPPINGS } from '../src/data/traitMappings';
import { evaluateQuiz, selectNextQuestion } from '../src/lib/adaptiveQuiz';
import { createQuizContext } from '../src/lib/context';
import { expectedInformationGain } from '../src/lib/informationGain';
import { scoreAnswers } from '../src/lib/scoring';
import type { Answer, Question } from '../src/types';
import { ANIMALS, personaPicker, randomPicker, runQuiz, HONEY_BADGER } from './helpers';

const ctx = createQuizContext();

describe('adaptive question selection', () => {
  it('always asks the four broad questions first, in order', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { answers } = runQuiz(ctx, randomPicker(ctx, seed));
      expect(answers.slice(0, 4).map((a) => a.questionId)).toEqual(['habitat', 'lifestyle', 'sociality', 'rhythm']);
    }
  });

  it('never selects an already answered question', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { answers } = runQuiz(ctx, randomPicker(ctx, seed));
      const ids = answers.map((a) => a.questionId);
      expect(new Set(ids).size).toBe(ids.length);
      for (let n = 0; n < answers.length; n++) {
        const next = selectNextQuestion({ ctx, answers: answers.slice(0, n) });
        expect(ids.slice(0, n)).not.toContain(next!.question.id);
      }
    }
  });

  it('picks the unanswered question with the highest expected information gain', () => {
    const answers: Answer[] = [
      { questionId: 'habitat', optionId: 'ocean' },
      { questionId: 'lifestyle', optionId: 'hunt' },
      { questionId: 'sociality', optionId: 'squad' },
      { questionId: 'rhythm', optionId: 'afternoon' },
    ];
    const scores = scoreAnswers(ctx, answers);
    const selection = selectNextQuestion({ ctx, answers, currentScores: scores })!;
    expect(selection.reason).toBe('information-gain');

    const gains = ctx.questions
      .filter((q) => !answers.some((a) => a.questionId === q.id))
      .map((q) => expectedInformationGain(ctx, q, scores).gain);
    expect(selection.gain).toBeCloseTo(Math.max(...gains), 12);
    expect(selection.ranking!.map((r) => r.gain)).toEqual([...selection.ranking!.map((r) => r.gain)].sort((a, b) => b - a));
  });

  it('prefers informative questions over ones that cannot separate candidates', () => {
    const useless: Question = {
      id: 'useless',
      phase: 'adaptive',
      weight: 1,
      prompt: 'Tea or coffee?',
      options: [
        { id: 'tea', label: 'Tea' },
        { id: 'coffee', label: 'Coffee' },
      ],
    };
    const questions = [...QUESTIONS.slice(0, 4), useless, ...QUESTIONS.slice(4)];
    const mappings = { ...TRAIT_MAPPINGS, useless: { tea: {}, coffee: {} } };
    const custom = createQuizContext({ questions, mappings });

    for (let seed = 1; seed <= 10; seed++) {
      const { answers } = runQuiz(custom, randomPicker(custom, seed));
      expect(answers[4]!.questionId).not.toBe('useless');
    }
  });

  it('adapts: different early answers lead to different follow-up questions', () => {
    const followUps = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const { answers } = runQuiz(ctx, randomPicker(ctx, seed));
      followUps.add(answers[4]!.questionId);
    }
    expect(followUps.size).toBeGreaterThan(2);
  });

  it('stops within the configured question limits', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { answers, evaluation } = runQuiz(ctx, randomPicker(ctx, seed));
      expect(evaluation.done).toBe(true);
      expect(answers.length).toBeLessThanOrEqual(ctx.config.maxQuestions);
      expect(answers.length).toBeGreaterThanOrEqual(ctx.broadQuestions.length);
    }
  });

  it('can stop early once one animal is clearly ahead', () => {
    const { answers, evaluation } = runQuiz(ctx, personaPicker(ctx, 'giant-pacific-octopus'));
    expect(evaluation.stopReason).toBe('confident');
    expect(answers.length).toBeLessThan(ctx.questions.length);
  });

  it('lets every animal win when answering as that animal would', () => {
    for (const animal of ctx.animals) {
      const { evaluation } = runQuiz(ctx, personaPicker(ctx, animal.id));
      expect(evaluation.scores.ranked[0]!.animal.id, animal.name).toBe(animal.id);
    }
  });

  it('incorporates a newly added animal without any other changes', () => {
    const extended = createQuizContext({ animals: [...ANIMALS, HONEY_BADGER] });
    expect(extended.animals).toHaveLength(ANIMALS.length + 1);

    const { evaluation } = runQuiz(extended, personaPicker(extended, 'honey-badger'));
    expect(evaluation.scores.ranked[0]!.animal.id).toBe('honey-badger');

    for (let seed = 1; seed <= 10; seed++) {
      const run = runQuiz(extended, randomPicker(extended, seed));
      expect(run.evaluation.scores.ranked).toHaveLength(ANIMALS.length + 1);
      const total = run.evaluation.scores.ranked.reduce((s, c) => s + c.probability, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it('is deterministic for the same sequence of answers', () => {
    const a = runQuiz(ctx, randomPicker(ctx, 99));
    const b = runQuiz(ctx, randomPicker(ctx, 99));
    expect(b.answers).toEqual(a.answers);
    expect(evaluateQuiz(ctx, b.answers).scores.ranked[0]!.animal.id).toBe(a.evaluation.scores.ranked[0]!.animal.id);
  });
});
