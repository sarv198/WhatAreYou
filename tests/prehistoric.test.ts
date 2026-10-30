import { describe, expect, it } from 'vitest';
import { QUIZ_COPY } from '../src/data/quizCopy';
import { isQuizId, QUIZ_DATA, QUIZ_IDS } from '../src/data/quizzes';
import { getQuizContext } from '../src/lib/quizContexts';
import { validateAnimalSet, validateQuestionBank } from '../src/lib/validation';
import { personaPicker, randomPicker, runQuiz } from './helpers';

const data = QUIZ_DATA.prehistoric;
const ctx = getQuizContext('prehistoric');

describe('prehistoric quiz', () => {
  it('ships 50 valid creatures and a valid ten-question bank', () => {
    expect(data.animals).toHaveLength(50);
    expect(validateAnimalSet(data.animals)).toEqual([]);
    expect(data.questions).toHaveLength(10);
    expect(validateQuestionBank(data.questions, data.mappings)).toEqual([]);
  });

  it('opens with habitat, lifestyle and sociality', () => {
    expect(ctx.broadQuestions.map((q) => q.id)).toEqual(['habitat', 'lifestyle', 'sociality']);
  });

  it('drops the abandoned city and merges ocean and river into one body of water', () => {
    const habitat = data.questions.find((q) => q.id === 'habitat')!;
    expect(habitat.options.map((o) => o.id)).not.toContain('city');
    expect(habitat.options.filter((o) => /water/i.test(o.label))).toHaveLength(1);
  });

  it('offers no regeneration, poison or camouflage superpowers', () => {
    const superpower = data.questions.find((q) => q.id === 'superpower')!;
    const ids = superpower.options.map((o) => o.id);
    for (const removed of ['regeneration', 'poison', 'camouflage']) expect(ids).not.toContain(removed);
    expect(ids).toEqual(expect.arrayContaining(['size', 'senses']));
  });

  it('lets every creature win when answering as that creature would', () => {
    for (const animal of ctx.animals) {
      const { evaluation } = runQuiz(ctx, personaPicker(ctx, animal.id));
      expect(evaluation.scores.ranked[0]!.animal.id, animal.name).toBe(animal.id);
    }
  });

  it('always finishes within ten questions', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { answers } = runQuiz(ctx, randomPicker(ctx, seed));
      expect(answers.length).toBeGreaterThanOrEqual(7);
      expect(answers.length).toBeLessThanOrEqual(10);
    }
  });

  it('only balances creatures that exist', () => {
    const ids = new Set(data.animals.map((a) => a.id));
    for (const id of Object.keys(data.balance)) expect(ids.has(id), id).toBe(true);
  });
});

describe('quiz registry', () => {
  it('gives every quiz its own path and storage key, keeping the originals for the main quiz', () => {
    expect(QUIZ_COPY.animals.path).toBe('/');
    expect(QUIZ_COPY.animals.storageKey).toBe('what-animal-are-you:v1');
    expect(new Set(QUIZ_IDS.map((id) => QUIZ_COPY[id].path)).size).toBe(QUIZ_IDS.length);
    expect(new Set(QUIZ_IDS.map((id) => QUIZ_COPY[id].storageKey)).size).toBe(QUIZ_IDS.length);
  });

  it('recognises only real quiz ids', () => {
    expect(isQuizId('prehistoric')).toBe(true);
    expect(isQuizId('toString')).toBe(false);
    expect(isQuizId('__proto__')).toBe(false);
    expect(isQuizId(undefined)).toBe(false);
  });
});
