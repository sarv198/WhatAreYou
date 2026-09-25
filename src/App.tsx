import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Landing } from './components/Landing';
import { QuizScreen } from './components/QuizScreen';
import { ResultScreen } from './components/ResultScreen';
import { Revealing } from './components/Revealing';
import { useQuiz } from './hooks/useQuiz';
import { createQuizContext } from './lib/context';

const ctx = createQuizContext();

export function App() {
  const { state, view, actions, insight, hasProgress, resumeLabel } = useQuiz(ctx);

  // Play the reveal only when a quiz has just been completed, not when restoring a saved result.
  const [revealing, setRevealing] = useState(false);
  const previousStatus = useRef(state.status);
  useEffect(() => {
    if (previousStatus.current === 'quiz' && state.status === 'result') setRevealing(true);
    previousStatus.current = state.status;
  }, [state.status]);
  const finishReveal = useCallback(() => setRevealing(false), []);

  const screen =
    state.status === 'intro'
      ? 'intro'
      : state.status === 'quiz'
        ? 'quiz'
        : revealing
          ? 'reveal'
          : 'result';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          {screen === 'intro' && (
            <Landing
              animals={ctx.animals}
              onStart={actions.start}
              onRestart={actions.restart}
              resumeLabel={hasProgress ? resumeLabel() : null}
            />
          )}
          {screen === 'quiz' && view.currentQuestion && (
            <QuizScreen
              animals={ctx.animals}
              broadCount={ctx.broadQuestions.length}
              view={view}
              insight={insight}
              onAnswer={actions.answer}
              onBack={actions.back}
              onRestart={actions.restart}
              onExit={actions.exit}
            />
          )}
          {screen === 'reveal' && view.result && (
            <Revealing contenders={view.result.matches.map((m) => m.animal.name)} onDone={finishReveal} />
          )}
          {screen === 'result' && view.result && (
            <ResultScreen
              result={view.result}
              animals={ctx.animals}
              scores={view.candidateScores}
              onRestart={actions.restart}
              onBack={actions.back}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
