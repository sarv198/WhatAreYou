import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Landing } from './components/Landing';
import { QuizScreen } from './components/QuizScreen';
import { ResultScreen } from './components/ResultScreen';
import { Revealing } from './components/Revealing';
import { QUIZ_COPY } from './data/quizCopy';
import { QUIZ_IDS, type QuizId } from './data/quizzes';
import { useQuiz } from './hooks/useQuiz';
import { useQuizCount } from './hooks/useQuizCount';
import { getQuizContext } from './lib/quizContexts';
import { startNewRun } from './lib/statsClient';

function quizFromPath(pathname: string): QuizId {
  const path = pathname.replace(/\/+$/, '') || '/';
  return QUIZ_IDS.find((id) => QUIZ_COPY[id].path === path) ?? 'animals';
}

/** Picks the quiz from the URL and swaps its theme in. */
export function App() {
  const [route, setRoute] = useState(() => ({ quiz: quizFromPath(window.location.pathname), switched: false }));
  const { quiz } = route;

  useEffect(() => {
    const onPop = () => setRoute({ quiz: quizFromPath(window.location.pathname), switched: true });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const switchQuiz = useCallback((next: QuizId) => {
    const { path } = QUIZ_COPY[next];
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setRoute({ quiz: next, switched: true });
  }, []);

  useEffect(() => {
    const copy = QUIZ_COPY[quiz];
    document.documentElement.dataset.quiz = quiz;
    document.title = copy.documentTitle;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', copy.themeColor);
  }, [quiz]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={quiz}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          <QuizExperience quiz={quiz} startAtIntro={route.switched} onSwitchQuiz={switchQuiz} />
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

interface QuizExperienceProps {
  quiz: QuizId;
  /** Open on the landing page rather than resuming mid-quiz. */
  startAtIntro: boolean;
  onSwitchQuiz: (quiz: QuizId) => void;
}

/** One quiz from landing to result. Remounted when the quiz changes. */
function QuizExperience({ quiz, startAtIntro, onSwitchQuiz }: QuizExperienceProps) {
  const ctx = getQuizContext(quiz);
  const copy = QUIZ_COPY[quiz];
  const { state, view, actions, insight, hasProgress, resumeLabel } = useQuiz(ctx, copy.storageKey, startAtIntro);
  const { count: quizCount, lastRecorded, recordCompletion } = useQuizCount(quiz);

  const start = useCallback(() => {
    if (!hasProgress) startNewRun(quiz);
    actions.start();
  }, [actions, hasProgress, quiz]);

  const restart = useCallback(() => {
    startNewRun(quiz);
    actions.restart();
  }, [actions, quiz]);

  // Play the reveal (and count the completion) only when a quiz has just been
  // completed, not when restoring a saved result.
  const [revealing, setRevealing] = useState(false);
  const previousStatus = useRef(state.status);
  const resultAnimalId = view.result?.animal.id;
  const latestAnswers = useRef(view.answers);
  latestAnswers.current = view.answers;
  useEffect(() => {
    if (previousStatus.current === 'quiz' && state.status === 'result') {
      setRevealing(true);
      if (resultAnimalId) void recordCompletion(resultAnimalId, latestAnswers.current);
    }
    previousStatus.current = state.status;
  }, [state.status, resultAnimalId, recordCompletion]);
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
            quiz={quiz}
            copy={copy}
            animals={ctx.animals}
            onStart={start}
            onRestart={restart}
            onSwitchQuiz={onSwitchQuiz}
            resumeLabel={hasProgress ? resumeLabel() : null}
            quizCount={quizCount}
          />
        )}
        {screen === 'quiz' && view.currentQuestion && (
          <QuizScreen
            copy={copy}
            animals={ctx.animals}
            broadCount={ctx.broadQuestions.length}
            view={view}
            insight={insight}
            quizCount={quizCount}
            onAnswer={actions.answer}
            onBack={actions.back}
            onRestart={restart}
            onExit={actions.exit}
          />
        )}
        {screen === 'reveal' && view.result && (
          <Revealing
            label={copy.revealing}
            contenders={view.result.matches.map((m) => m.animal.name)}
            onDone={finishReveal}
          />
        )}
        {screen === 'result' && view.result && (
          <ResultScreen
            quiz={quiz}
            copy={copy}
            result={view.result}
            animals={ctx.animals}
            scores={view.candidateScores}
            recorded={lastRecorded}
            onRestart={restart}
            onBack={actions.back}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
