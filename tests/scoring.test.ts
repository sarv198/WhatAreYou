import { describe, expect, it } from 'vitest';
import { createQuizContext } from '../src/lib/context';
import { buildUserProfile, scoreAnswers } from '../src/lib/scoring';
import { generateResult } from '../src/lib/resultGenerator';
import type { Answer } from '../src/types';
import { randomPicker, runQuiz } from './helpers';

const ctx = createQuizContext();

const probabilityOf = (answers: Answer[], id: string) =>
  scoreAnswers(ctx, answers).ranked.find((s) => s.animal.id === id)!.probability;

describe('scoring', () => {
  it('gives the same result for the same answers', () => {
    const { answers } = runQuiz(ctx, randomPicker(ctx, 7));
    const a = scoreAnswers(ctx, answers);
    const b = scoreAnswers(ctx, [...answers]);
    expect(b.ranked.map((s) => [s.animal.id, s.probability])).toEqual(
      a.ranked.map((s) => [s.animal.id, s.probability]),
    );
    expect(generateResult(ctx, answers).animal.id).toBe(generateResult(ctx, answers).animal.id);
  });

  it('does not depend on the order answers are supplied in', () => {
    const { answers } = runQuiz(ctx, randomPicker(ctx, 11));
    const forward = scoreAnswers(ctx, answers).ranked.map((s) => s.probability);
    const reversed = scoreAnswers(ctx, [...answers].reverse()).ranked.map((s) => s.probability);
    forward.forEach((p, i) => expect(reversed[i]).toBeCloseTo(p, 12));
  });

  it('moves candidate scores in the expected direction when a key answer changes', () => {
    const base: Answer[] = [
      { questionId: 'lifestyle', optionId: 'hunt' },
      { questionId: 'sociality', optionId: 'family' },
      { questionId: 'rhythm', optionId: 'morning' },
    ];
    const ocean = [{ questionId: 'habitat', optionId: 'ocean' }, ...base];
    const desert = [{ questionId: 'habitat', optionId: 'desert' }, ...base];

    expect(probabilityOf(ocean, 'orca')).toBeGreaterThan(probabilityOf(desert, 'orca') * 10);
    expect(probabilityOf(desert, 'harris-hawk')).toBeGreaterThan(probabilityOf(ocean, 'harris-hawk') * 10);
    expect(scoreAnswers(ctx, ocean).ranked[0]!.animal.profile.habitat?.ocean ?? 0).toBeGreaterThan(0.5);
    expect(scoreAnswers(ctx, desert).ranked[0]!.animal.profile.habitat?.desert ?? 0).toBeGreaterThan(0.5);
  });

  it('keeps scores normalised for any answer sequence', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { answers } = runQuiz(ctx, randomPicker(ctx, seed));
      for (let n = 0; n <= answers.length; n++) {
        const { ranked } = scoreAnswers(ctx, answers.slice(0, n));
        const total = ranked.reduce((sum, s) => sum + s.probability, 0);
        expect(total).toBeCloseTo(1, 9);
        for (const s of ranked) {
          expect(s.probability).toBeGreaterThanOrEqual(0);
          expect(s.probability).toBeLessThanOrEqual(1);
          expect(s.compatibility).toBeGreaterThanOrEqual(0);
          expect(s.compatibility).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('builds a cumulative user vector that averages repeated evidence instead of stacking it', () => {
    const one = buildUserProfile(ctx, [{ questionId: 'danger', optionId: 'stand' }]);
    const two = buildUserProfile(ctx, [
      { questionId: 'danger', optionId: 'stand' },
      { questionId: 'confidence', optionId: 'knowGood' },
    ]);
    const confidence = [...one.target.keys()].find((i) => one.evidence[i]! > 0 && two.evidence[i]! > one.evidence[i]!)!;
    expect(two.target[confidence]).toBeLessThanOrEqual(1);
    expect(two.evidence[confidence]).toBeGreaterThan(one.evidence[confidence]!);
  });

  it('never eliminates an animal outright after one mismatch', () => {
    const answers = [{ questionId: 'habitat', optionId: 'desert' }];
    const orca = scoreAnswers(ctx, answers).ranked.find((s) => s.animal.id === 'orca')!;
    expect(orca.probability).toBeGreaterThan(0);
  });
});
