import type { Answer, Question } from '../types';
import type { QuizContext } from './context';
import { expectedInformationGain, type QuestionGain } from './informationGain';
import { scoreAnswers, type ScoreSnapshot } from './scoring';

export type SelectionReason = 'broad' | 'information-gain';

export interface QuestionSelection {
  question: Question;
  reason: SelectionReason;
  /** Expected information gain in bits (adaptive phase only). */
  gain?: number;
  /** Every candidate question with its gain, best first (adaptive phase only). */
  ranking?: QuestionGain[];
}

export type StopReason = 'confident' | 'certain' | 'converged' | 'max-questions' | 'exhausted';

export interface QuizEvaluation {
  scores: ScoreSnapshot;
  done: boolean;
  next: QuestionSelection | null;
  stopReason?: StopReason;
}

/**
 * Picks the next question.
 *
 * Phase A: broad questions, always, in their configured order.
 * Phase B: the unanswered question with the highest expected information gain
 *          over the animals still in the running. Ties go to bank order.
 */
export function selectNextQuestion({
  ctx,
  answers,
  currentScores,
}: {
  ctx: QuizContext;
  answers: readonly Answer[];
  currentScores?: ScoreSnapshot;
}): QuestionSelection | null {
  const answered = new Set(answers.map((a) => a.questionId));

  const broad = ctx.broadQuestions.find((q) => !answered.has(q.id));
  if (broad) return { question: broad, reason: 'broad' };

  const remaining = ctx.questions.filter((q) => !answered.has(q.id));
  if (remaining.length === 0) return null;

  const scores = currentScores ?? scoreAnswers(ctx, answers);
  const ranking = remaining
    .map((q) => expectedInformationGain(ctx, q, scores))
    .map((g, order) => ({ g, order }))
    .sort((a, b) => b.g.gain - a.g.gain || a.order - b.order)
    .map(({ g }) => g);

  const best = ranking[0]!;
  return { question: best.question, reason: 'information-gain', gain: best.gain, ranking };
}

/** Stop rules that only need the current scores. */
function earlyStopReason(ctx: QuizContext, answers: readonly Answer[], scores: ScoreSnapshot): StopReason | null {
  const { config } = ctx;
  const count = answers.length;

  if (count < ctx.broadQuestions.length) return null;
  if (count >= config.maxQuestions) return 'max-questions';
  if (count >= ctx.questions.length) return 'exhausted';

  // Nothing left to distinguish: a single animal holds essentially all belief.
  if (scores.poolEntropy < 0.01 && scores.ranked[0]!.probability > 0.999) return 'certain';

  if (count >= config.minQuestions) {
    const [top, second] = scores.ranked;
    const margin = second && second.probability > 0 ? top!.probability / second.probability : Infinity;
    if (top!.probability >= config.confidentProbability && margin >= config.confidentMargin) {
      return 'confident';
    }
  }
  return null;
}

/** Scores the answers so far and decides whether to stop or which question to ask next. */
export function evaluateQuiz(ctx: QuizContext, answers: readonly Answer[]): QuizEvaluation {
  const scores = scoreAnswers(ctx, answers);

  const early = earlyStopReason(ctx, answers, scores);
  if (early) return { scores, done: true, next: null, stopReason: early };

  const next = selectNextQuestion({ ctx, answers, currentScores: scores });
  if (!next) return { scores, done: true, next: null, stopReason: 'exhausted' };

  if (
    next.reason === 'information-gain' &&
    answers.length >= ctx.config.minQuestions &&
    (next.gain ?? 0) < ctx.config.minUsefulGain
  ) {
    return { scores, done: true, next: null, stopReason: 'converged' };
  }

  return { scores, done: false, next };
}
