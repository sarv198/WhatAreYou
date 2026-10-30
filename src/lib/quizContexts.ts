import { QUIZ_DATA, type QuizId } from '../data/quizzes';
import { createQuizContext, type QuizContext } from './context';

/** Builds the engine context for one quiz, optionally with different balance offsets. */
export function createContextFor(id: QuizId, balance?: Record<string, number>): QuizContext {
  const data = QUIZ_DATA[id];
  return createQuizContext({
    animals: data.animals,
    questions: data.questions,
    mappings: data.mappings,
    balance: balance ?? data.balance,
    config: data.config,
  });
}

const cache = new Map<QuizId, QuizContext>();

/** Shared, lazily-built context per quiz for the app. */
export function getQuizContext(id: QuizId): QuizContext {
  let ctx = cache.get(id);
  if (!ctx) {
    ctx = createContextFor(id);
    cache.set(id, ctx);
  }
  return ctx;
}
