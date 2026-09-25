import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { QuizContext } from '../lib/context';
import { deriveQuizView, quizReducer, restoreState, type QuizAction, type QuizState } from '../lib/quizState';

const STORAGE_KEY = 'what-animal-are-you:v1';

function loadSaved(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(state: QuizState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota) — progress just won't survive a reload.
  }
}

function tieBreak(name: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Insight {
  id: number;
  ruledOut: string[];
  returning: string[];
  remaining: number;
}

/** Quiz state + derived view, persisted so a reload never loses progress. */
export function useQuiz(ctx: QuizContext) {
  const [state, dispatch] = useReducer(
    (s: QuizState, a: QuizAction) => quizReducer(ctx, s, a),
    undefined,
    () => restoreState(ctx, loadSaved()),
  );
  const view = useMemo(() => deriveQuizView(ctx, state), [ctx, state]);

  useEffect(() => save(state), [state]);

  // Narrate what the last answer did to the candidate pool.
  const [insight, setInsight] = useState<Insight | null>(null);
  const toEntries = (pool: typeof view.pool) => pool.map((s) => ({ name: s.animal.name, p: s.probability }));
  const previous = useRef({ cursor: state.cursor, status: state.status, pool: toEntries(view.pool) });
  useEffect(() => {
    const prev = previous.current;
    const pool = toEntries(view.pool);
    const movedForward = state.status === 'quiz' && prev.status === 'quiz' && state.cursor === prev.cursor + 1;
    if (movedForward) {
      const before = new Set(prev.pool.map((e) => e.name));
      const after = new Set(pool.map((e) => e.name));
      // Most notable departures first; exact ties get a stable per-step shuffle so the copy varies.
      const ruledOut = prev.pool
        .filter((e) => !after.has(e.name))
        .sort((a, b) => b.p - a.p || tieBreak(a.name, state.cursor) - tieBreak(b.name, state.cursor))
        .map((e) => e.name);
      setInsight((i) => ({
        id: (i?.id ?? 0) + 1,
        ruledOut,
        returning: pool.filter((e) => !before.has(e.name)).map((e) => e.name),
        remaining: pool.length,
      }));
    } else if (state.cursor !== prev.cursor || state.status !== prev.status) {
      setInsight(null);
    }
    previous.current = { cursor: state.cursor, status: state.status, pool };
  }, [state.cursor, state.status, view.pool]);

  const actions = useMemo(
    () => ({
      start: () => dispatch({ type: 'start' }),
      answer: (optionId: string) => dispatch({ type: 'answer', optionId }),
      back: () => dispatch({ type: 'back' }),
      restart: () => dispatch({ type: 'restart' }),
      exit: () => dispatch({ type: 'exit' }),
    }),
    [],
  );

  const hasProgress = state.history.length > 0 && (state.cursor > 0 || state.status === 'result');
  const resumeLabel = useCallback(
    () => (state.cursor >= state.history.length ? 'See your result again' : `Continue from question ${state.cursor + 1}`),
    [state.cursor, state.history.length],
  );

  return { state, view, actions, insight, hasProgress, resumeLabel };
}
