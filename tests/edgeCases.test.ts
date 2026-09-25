import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/data/questions';
import { TRAIT_MAPPINGS } from '../src/data/traitMappings';
import { createQuizContext } from '../src/lib/context';
import { generateResult } from '../src/lib/resultGenerator';
import { scoreAnswers } from '../src/lib/scoring';
import { validateAnimal } from '../src/lib/validation';
import type { Answer, TraitMappings } from '../src/types';
import { ANIMALS, cloneAnimal, personaPicker, runQuiz, SNOW_LEOPARD } from './helpers';

const ctx = createQuizContext();

describe('edge cases', () => {
  it('handles entirely neutral answers without crashing and resolves ties deterministically', () => {
    const neutral: TraitMappings = Object.fromEntries(
      QUESTIONS.map((q) => [q.id, Object.fromEntries(q.options.map((o) => [o.id, {}]))]),
    );
    const neutralCtx = createQuizContext({ mappings: neutral });
    const { answers, evaluation } = runQuiz(neutralCtx, (qid) => neutralCtx.questionsById.get(qid)!.options[0]!.id);

    expect(evaluation.done).toBe(true);
    expect(answers.length).toBeLessThanOrEqual(neutralCtx.config.maxQuestions);
    for (const s of evaluation.scores.ranked) expect(s.probability).toBeCloseTo(1 / ANIMALS.length, 12);
    expect(generateResult(neutralCtx, answers).animal.id).toBe(ANIMALS[0]!.id);
  });

  it('handles very contradictory answers gracefully', () => {
    const contradictory: Answer[] = [
      { questionId: 'habitat', optionId: 'desert' },
      { questionId: 'lifestyle', optionId: 'home' },
      { questionId: 'sociality', optionId: 'alone' },
      { questionId: 'rhythm', optionId: 'morning' },
      { questionId: 'personalSpace', optionId: 'crowd' },
      { questionId: 'dailyActivity', optionId: 'exercising' },
      { questionId: 'danger', optionId: 'stand' },
      { questionId: 'arguments', optionId: 'avoid' },
      { questionId: 'friends', optionId: 'leader' },
      { questionId: 'confidence', optionId: 'fluctuating' },
      { questionId: 'problemSolving', optionId: 'giveUp' },
      { questionId: 'sports', optionId: 'combat' },
    ];
    const snapshot = scoreAnswers(ctx, contradictory);
    const total = snapshot.ranked.reduce((sum, s) => sum + s.probability, 0);
    expect(total).toBeCloseTo(1, 9);
    expect(snapshot.ranked.every((s) => Number.isFinite(s.compatibility))).toBe(true);

    const result = generateResult(ctx, contradictory);
    expect(result.matchStrength).toBeGreaterThan(0);
    expect(result.matchStrength).toBeLessThanOrEqual(100);

    // A coherent persona should be matched far more confidently than a contradictory one.
    const coherent = runQuiz(ctx, personaPicker(ctx, 'fennec-fox')).evaluation.scores.ranked[0]!;
    expect(coherent.compatibility).toBeGreaterThan(snapshot.ranked[0]!.compatibility);
  });

  it('stops once only one candidate remains', () => {
    const single = createQuizContext({ animals: [SNOW_LEOPARD] });
    const { answers, evaluation } = runQuiz(single, (qid) => single.questionsById.get(qid)!.options[0]!.id);
    expect(evaluation.stopReason).toBe('certain');
    expect(answers).toHaveLength(single.broadQuestions.length);
    expect(generateResult(single, answers).animal.id).toBe('snow-leopard');
  });

  it('breaks exact ties by data order', () => {
    const twinA = cloneAnimal(SNOW_LEOPARD, { id: 'twin-a', name: 'Twin A' });
    const twinB = cloneAnimal(SNOW_LEOPARD, { id: 'twin-b', name: 'Twin B' });
    const answers = runQuiz(ctx, personaPicker(ctx, 'canada-lynx')).answers;

    const ab = createQuizContext({ animals: [...ANIMALS, twinA, twinB] });
    const ba = createQuizContext({ animals: [...ANIMALS, twinB, twinA] });
    const abScores = scoreAnswers(ab, answers).ranked;
    const pa = abScores.find((s) => s.animal.id === 'twin-a')!;
    const pb = abScores.find((s) => s.animal.id === 'twin-b')!;
    expect(pa.probability).toBe(pb.probability);
    expect(abScores.indexOf(pa)).toBeLessThan(abScores.indexOf(pb));
    const baScores = scoreAnswers(ba, answers).ranked;
    expect(baScores.findIndex((s) => s.animal.id === 'twin-b')).toBeLessThan(baScores.findIndex((s) => s.animal.id === 'twin-a'));
  });

  it('accepts a new animal with a valid profile and rejects invalid ones', () => {
    expect(validateAnimal(SNOW_LEOPARD)).toEqual([]);

    const outOfRange = cloneAnimal(SNOW_LEOPARD, { profile: { ...SNOW_LEOPARD.profile, mind: { intellect: 1.5 } } });
    expect(validateAnimal(outOfRange).join()).toMatch(/between 0 and 1/);

    const unknownTrait = cloneAnimal(SNOW_LEOPARD, {
      profile: { ...SNOW_LEOPARD.profile, mind: { telepathy: 1 } as never },
    });
    expect(validateAnimal(unknownTrait).join()).toMatch(/unknown trait/);

    expect(() => createQuizContext({ animals: [...ANIMALS, outOfRange] })).toThrow(/Invalid quiz data/);
    expect(() => createQuizContext({ animals: [...ANIMALS, { ...SNOW_LEOPARD, id: 'tiger' }] })).toThrow(/Duplicate/);
  });

  it('ships with a valid data set of exactly 52 animals', () => {
    expect(ANIMALS).toHaveLength(52);
    expect(ANIMALS.flatMap(validateAnimal)).toEqual([]);
    expect(Object.keys(TRAIT_MAPPINGS).sort()).toEqual(QUESTIONS.map((q) => q.id).sort());
  });
});
