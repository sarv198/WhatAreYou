import { describe, expect, it } from 'vitest';
import { createQuizContext } from '../src/lib/context';
import {
  activeAnswers,
  deriveQuizView,
  INITIAL_STATE,
  quizReducer,
  restoreState,
  type QuizAction,
  type QuizState,
} from '../src/lib/quizState';
import { generateResult } from '../src/lib/resultGenerator';
import { scoreAnswers } from '../src/lib/scoring';
import { mulberry32 } from './helpers';

const ctx = createQuizContext();
const reduce = (state: QuizState, ...actions: QuizAction[]) =>
  actions.reduce((s, a) => quizReducer(ctx, s, a), state);

/** Answers with a seeded random option until the quiz finishes or `limit` answers are given. */
function answerRandomly(state: QuizState, seed: number, limit = Infinity): QuizState {
  const rand = mulberry32(seed);
  let s = state;
  let n = 0;
  while (s.status === 'quiz' && n < limit) {
    const question = ctx.questionsById.get(s.history[s.cursor]!)!;
    s = reduce(s, { type: 'answer', optionId: question.options[Math.floor(rand() * question.options.length)]!.id });
    n++;
  }
  return s;
}

describe('quiz navigation', () => {
  it('starts at the first broad question', () => {
    const state = reduce(INITIAL_STATE, { type: 'start' });
    expect(state.status).toBe('quiz');
    expect(state.history).toEqual(['habitat']);
    expect(deriveQuizView(ctx, state).currentQuestion!.id).toBe('habitat');
  });

  it('goes back to the previous question with its answer still selected', () => {
    let state = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 3, 3);
    expect(state.cursor).toBe(3);
    const previous = state.history[2]!;

    state = reduce(state, { type: 'back' });
    const view = deriveQuizView(ctx, state);
    expect(state.cursor).toBe(2);
    expect(view.currentQuestion!.id).toBe(previous);
    expect(view.currentSelection).toBe(state.selections[previous]);
    expect(view.answers).toHaveLength(2);
  });

  it('goes back from the result to the last question', () => {
    let state = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 5);
    expect(state.status).toBe('result');
    const last = state.history[state.history.length - 1];
    state = reduce(state, { type: 'back' });
    expect(state.status).toBe('quiz');
    expect(deriveQuizView(ctx, state).currentQuestion!.id).toBe(last);
  });

  it('re-answering the same option continues along the same path', () => {
    const finished = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 8);
    let state = reduce(finished, { type: 'back' }, { type: 'back' }, { type: 'back' });
    while (state.status === 'quiz') {
      state = reduce(state, { type: 'answer', optionId: state.selections[state.history[state.cursor]!]! });
    }
    expect(state.history).toEqual(finished.history);
    expect(deriveQuizView(ctx, state).result!.animal.id).toBe(deriveQuizView(ctx, finished).result!.animal.id);
  });

  it('recomputes scores from scratch when an earlier answer changes', () => {
    const finished = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 12);
    let state = finished;
    while (state.cursor > 0) state = reduce(state, { type: 'back' });
    expect(state.history[0]).toBe('habitat');

    const newHabitat = state.selections.habitat === 'ocean' ? 'desert' : 'ocean';
    state = reduce(state, { type: 'answer', optionId: newHabitat });
    expect(state.selections.habitat).toBe(newHabitat);

    // The scores must equal a fresh computation; nothing from the old answer lingers.
    const view = deriveQuizView(ctx, state);
    const fresh = scoreAnswers(ctx, [{ questionId: 'habitat', optionId: newHabitat }]);
    expect(view.candidateScores.map((s) => s.probability)).toEqual(fresh.ranked.map((s) => s.probability));

    // Finishing the quiz again yields exactly what a clean run of the final answers yields.
    const rand = mulberry32(1);
    while (state.status === 'quiz') {
      const q = ctx.questionsById.get(state.history[state.cursor]!)!;
      const remembered = state.selections[q.id];
      state = reduce(state, { type: 'answer', optionId: remembered ?? q.options[Math.floor(rand() * q.options.length)]!.id });
    }
    const answers = activeAnswers(state);
    expect(answers.find((a) => a.questionId === 'habitat')!.optionId).toBe(newHabitat);
    expect(deriveQuizView(ctx, state).result!.animal.id).toBe(generateResult(ctx, answers).animal.id);
  });

  it('drops the rest of the path when a changed answer leads to a different next question', () => {
    const finished = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 21);
    let state = finished;
    while (state.cursor > 4) state = reduce(state, { type: 'back' });
    const q = ctx.questionsById.get(state.history[4]!)!;
    for (const option of q.options) {
      const next = reduce(state, { type: 'answer', optionId: option.id });
      const view = deriveQuizView(ctx, next);
      expect(next.history.slice(0, 5)).toEqual(finished.history.slice(0, 5));
      if (next.status === 'quiz') expect(view.selection!.question.id).toBe(next.history[next.cursor]);
      expect(view.answers).toHaveLength(5);
    }
  });

  it('restart clears all answers and returns to the first question', () => {
    const finished = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 4);
    const state = reduce(finished, { type: 'restart' });
    expect(state).toEqual({ status: 'quiz', history: ['habitat'], cursor: 0, selections: {} });
    expect(deriveQuizView(ctx, state).answers).toEqual([]);
  });

  it('restores saved progress and discards anything inconsistent', () => {
    const midway = answerRandomly(reduce(INITIAL_STATE, { type: 'start' }), 9, 6);
    const restored = restoreState(ctx, JSON.parse(JSON.stringify(midway)));
    expect(restored).toEqual(midway);

    const tampered = { ...midway, selections: { ...midway.selections, habitat: 'moon' } };
    const fallback = restoreState(ctx, tampered);
    expect(fallback.cursor).toBe(0);
    expect(restoreState(ctx, 'garbage')).toEqual(INITIAL_STATE);
  });
});
