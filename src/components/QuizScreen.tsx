import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { Insight } from '../hooks/useQuiz';
import type { QuizView } from '../lib/quizState';
import type { AnimalProfile } from '../types';
import { Field } from './Field';
import { QuestionCard } from './QuestionCard';
import { QuizCounter } from './QuizCounter';
import styles from './QuizScreen.module.css';

interface QuizScreenProps {
  animals: readonly AnimalProfile[];
  broadCount: number;
  view: QuizView;
  insight: Insight | null;
  quizCount: number | null;
  onAnswer: (optionId: string) => void;
  onBack: () => void;
  onRestart: () => void;
  onExit: () => void;
}

const EVIDENCE_RAMP = 7;

function certaintyLabel(p: number): string {
  if (p < 0.12) return 'Just getting started';
  if (p < 0.25) return 'Forming a hunch';
  if (p < 0.45) return 'Closing in';
  if (p < 0.65) return 'Pretty sure';
  return 'Got you';
}

function list(names: string[], max = 2): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return shown.join('');
}

function narrate(insight: Insight): string {
  if (insight.returning.length > 0) {
    const [first] = insight.returning;
    return insight.returning.length === 1
      ? `Plot twist: the ${first} is back in contention.`
      : `Plot twist: ${list(insight.returning)} are back in contention.`;
  }
  if (insight.ruledOut.length > 0) return `Ruled out ${list(insight.ruledOut)}.`;
  if (insight.remaining === 1) return 'One clear frontrunner. Just making sure.';
  return `Still weighing ${insight.remaining} possibilities.`;
}

export function QuizScreen({
  animals,
  broadCount,
  view,
  insight,
  quizCount,
  onAnswer,
  onBack,
  onRestart,
  onExit,
}: QuizScreenProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  useEffect(() => {
    if (!confirmRestart) return;
    const t = window.setTimeout(() => setConfirmRestart(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmRestart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const question = view.currentQuestion!;
  const poolIds = useMemo(() => new Set(view.pool.map((s) => s.animal.id)), [view.pool]);
  const answered = view.answers.length;
  // A strong early lead on three answers shouldn't read as certainty yet.
  const top = view.candidateScores[0]!.probability * Math.min(1, answered / EVIDENCE_RAMP);
  const isBroad = view.selection?.reason === 'broad';

  const phase = isBroad
    ? `Broad strokes · ${answered + 1} of ${broadCount}`
    : view.pool.length <= 3
      ? 'Final read'
      : 'Narrowing in';

  const why = isBroad
    ? 'The first few questions sketch the big picture: where you live, how you spend your time, who you run with and when you come alive.'
    : `Chosen because it best separates the ${view.pool.length} animals still in the running. Your answers decide what comes next.`;

  return (
    <div className={styles.quiz}>
      <header className={styles.topbar}>
        <div className={styles.brandGroup}>
          <button type="button" className={styles.brand} onClick={onExit}>
            What animal are you?
          </button>
          <QuizCounter count={quizCount} variant="header" />
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.ghost} onClick={onBack} aria-keyshortcuts="Backspace">
            <span aria-hidden>←</span> Back
          </button>
          <button
            type="button"
            className={styles.ghost}
            data-warn={confirmRestart || undefined}
            onClick={() => (confirmRestart ? onRestart() : setConfirmRestart(true))}
          >
            {confirmRestart ? 'Sure? Tap again' : 'Restart'}
          </button>
        </div>
      </header>

      <main className={styles.stage}>
        <div className={styles.questionCol}>
          <motion.p key={phase} className={styles.phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className={styles.phaseDot} data-adaptive={!isBroad || undefined} aria-hidden />
            {phase}
          </motion.p>
          <AnimatePresence mode="wait" initial={false}>
            <QuestionCard
              key={`${question.id}-${view.questionNumber}`}
              question={question}
              number={view.questionNumber}
              selected={view.currentSelection}
              onAnswer={onAnswer}
            />
          </AnimatePresence>
        </div>

        <aside className={styles.panel} aria-label="How the quiz is reading you">
          <div className={styles.fieldBox}>
            <Field
              animals={animals}
              scores={view.candidateScores}
              poolIds={poolIds}
              mode={answered === 0 ? 'idle' : 'quiz'}
              label={`${view.pool.length} of ${animals.length} animals still in the running`}
            />
          </div>

          <div className={styles.stats}>
            <div className={styles.count}>
              <motion.strong key={view.pool.length} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {view.pool.length}
              </motion.strong>
              <span>of {animals.length} animals still in the running</span>
            </div>
            <div className={styles.certainty}>
              <span className={styles.certaintyLabel}>{answered === 0 ? 'Waiting for your first answer' : certaintyLabel(top)}</span>
              <div className={styles.meter} aria-hidden>
                <motion.div
                  className={styles.meterFill}
                  initial={false}
                  animate={{ scaleX: answered === 0 ? 0.02 : Math.min(1, Math.max(0.04, top / 0.75)) }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </div>

          <div className={styles.narration} aria-live="polite">
            <AnimatePresence mode="wait">
              {insight && (
                <motion.p
                  key={insight.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {narrate(insight)}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <p className={styles.why}>{why}</p>
        </aside>
      </main>
    </div>
  );
}
