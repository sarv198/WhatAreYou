import type { Answer, Question } from '../types';
import { evaluateQuiz, type QuestionSelection, type QuizEvaluation } from './adaptiveQuiz';
import type { QuizContext } from './context';
import { generateResult, type QuizResult } from './resultGenerator';
import type { CandidateScore } from './scoring';

/**
 * Minimal, serialisable quiz state. Everything else (scores, next question,
 * result) is derived from it, so changing an earlier answer can never leave
 * stale scores behind.
 *
 * Invariants:
 *  - status 'quiz':   0 ≤ cursor < history.length, history[cursor] is on screen,
 *                     history[0..cursor) are the answered questions.
 *  - status 'result': cursor === history.length, every question in history is answered.
 */
export interface QuizState {
  status: 'intro' | 'quiz' | 'result';
  /** Question ids on the current path, in the order they were asked. */
  history: string[];
  cursor: number;
  /**
   * Every selection the user has made, keyed by question id. May include
   * answers from a path they later abandoned. Those pre-fill the question
   * if it comes up again but never count towards scoring.
   */
  selections: Record<string, string>;
}

export type QuizAction =
  | { type: 'start' }
  | { type: 'answer'; optionId: string }
  | { type: 'back' }
  | { type: 'restart' }
  | { type: 'exit' };

export const INITIAL_STATE: QuizState = { status: 'intro', history: [], cursor: 0, selections: {} };

/** The answers that currently count: the path up to (not including) the cursor. */
export function activeAnswers(state: QuizState): Answer[] {
  return state.history.slice(0, state.cursor).map((questionId) => ({
    questionId,
    optionId: state.selections[questionId]!,
  }));
}

function freshQuiz(ctx: QuizContext): QuizState {
  const first = evaluateQuiz(ctx, []).next!.question.id;
  return { status: 'quiz', history: [first], cursor: 0, selections: {} };
}

function applyAnswer(ctx: QuizContext, state: QuizState, optionId: string): QuizState {
  const questionId = state.history[state.cursor]!;
  const question = ctx.questionsById.get(questionId)!;
  if (!question.options.some((o) => o.id === optionId)) return state;

  const selections = { ...state.selections, [questionId]: optionId };
  const answered = state.history.slice(0, state.cursor + 1);
  const evaluation = evaluateQuiz(
    ctx,
    answered.map((id) => ({ questionId: id, optionId: selections[id]! })),
  );

  if (evaluation.done) {
    return { status: 'result', history: answered, cursor: answered.length, selections };
  }

  const nextId = evaluation.next!.question.id;
  // Keep the rest of the path only if it still starts with the same next question.
  const history =
    state.history[state.cursor + 1] === nextId ? state.history : [...answered, nextId];
  return { status: 'quiz', history, cursor: state.cursor + 1, selections };
}

export function quizReducer(ctx: QuizContext, state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'start':
      return state.history.length > 0 ? { ...state, status: state.cursor >= state.history.length ? 'result' : 'quiz' } : freshQuiz(ctx);

    case 'answer':
      return state.status === 'quiz' ? applyAnswer(ctx, state, action.optionId) : state;

    case 'back':
      if (state.status === 'result') return { ...state, status: 'quiz', cursor: state.history.length - 1 };
      if (state.status === 'quiz') {
        return state.cursor > 0 ? { ...state, cursor: state.cursor - 1 } : { ...state, status: 'intro' };
      }
      return state;

    case 'restart':
      return freshQuiz(ctx);

    case 'exit':
      return { ...state, status: 'intro' };
  }
}

export interface QuizView {
  status: QuizState['status'];
  currentQuestion: Question | null;
  /** The option to show as selected on the current question, if any. */
  currentSelection: string | null;
  questionNumber: number;
  answers: Answer[];
  answeredQuestions: string[];
  questionHistory: string[];
  candidateScores: CandidateScore[];
  pool: CandidateScore[];
  selection: QuestionSelection | null;
  evaluation: QuizEvaluation;
  result: QuizResult | null;
  canGoBack: boolean;
}

/**
 * Everything the UI needs, derived from state. The shape mirrors the quiz
 * state described in the brief: currentQuestion, answers, answeredQuestions,
 * candidateScores, questionHistory, result.
 */
export function deriveQuizView(ctx: QuizContext, state: QuizState): QuizView {
  const answers = activeAnswers(state);
  const evaluation = evaluateQuiz(ctx, answers);
  const currentId = state.status === 'quiz' ? state.history[state.cursor] : undefined;
  const currentQuestion = currentId ? ctx.questionsById.get(currentId) ?? null : null;

  return {
    status: state.status,
    currentQuestion,
    currentSelection: currentId ? state.selections[currentId] ?? null : null,
    questionNumber: state.cursor + 1,
    answers,
    answeredQuestions: answers.map((a) => a.questionId),
    questionHistory: state.history,
    candidateScores: evaluation.scores.ranked,
    pool: evaluation.scores.pool,
    selection: state.status === 'quiz' ? evaluation.next : null,
    evaluation,
    result: state.status === 'result' ? generateResult(ctx, answers, evaluation.scores) : null,
    canGoBack: state.status !== 'intro',
  };
}

/**
 * Validates state restored from storage by replaying it through the engine.
 * Anything inconsistent with the current question bank is trimmed away.
 */
export function restoreState(ctx: QuizContext, raw: unknown): QuizState {
  if (!raw || typeof raw !== 'object') return INITIAL_STATE;
  const candidate = raw as Partial<QuizState>;
  if (!Array.isArray(candidate.history) || typeof candidate.selections !== 'object' || !candidate.selections) {
    return INITIAL_STATE;
  }
  const selections: Record<string, string> = {};
  for (const [q, o] of Object.entries(candidate.selections)) {
    if (typeof o === 'string' && ctx.questionsById.get(q)?.options.some((opt) => opt.id === o)) selections[q] = o;
  }

  const targetCursor = typeof candidate.cursor === 'number' ? candidate.cursor : 0;
  let state = freshQuiz(ctx);
  state = { ...state, selections };
  while (state.status === 'quiz' && state.cursor < targetCursor) {
    const id = state.history[state.cursor]!;
    if (candidate.history[state.cursor] !== id || !selections[id]) break;
    state = applyAnswer(ctx, state, selections[id]);
  }
  const status = candidate.status === 'intro' ? 'intro' : state.status;
  return { ...state, status };
}
