import { motion } from 'motion/react';
import type { QuizCopy } from '../data/quizCopy';
import type { QuizId } from '../data/quizzes';
import type { AnimalProfile } from '../types';
import { Field } from './Field';
import styles from './Landing.module.css';
import { QuizCounter } from './QuizCounter';
import { TRexSkull } from './TRexSkull';

interface LandingProps {
  quiz: QuizId;
  copy: QuizCopy;
  animals: readonly AnimalProfile[];
  onStart: () => void;
  onRestart: () => void;
  onSwitchQuiz: (quiz: QuizId) => void;
  resumeLabel: string | null;
  quizCount: number | null;
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Landing({ quiz, copy, animals, onStart, onRestart, onSwitchQuiz, resumeLabel, quizCount }: LandingProps) {
  return (
    <main className={styles.landing}>
      <motion.div
        className={styles.fieldWrap}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      >
        <Field animals={animals} mode="idle" />
      </motion.div>

      <div className={styles.content}>
        <motion.div className={styles.switcher} variants={rise} initial="hidden" animate="show" custom={0}>
          {quiz === 'animals' ? (
            <button type="button" className={styles.prehistoric} onClick={() => onSwitchQuiz('prehistoric')}>
              <TRexSkull className={styles.skull} />
              Prehistoric Animal Quiz
              <span className={styles.arrow} aria-hidden>
                →
              </span>
            </button>
          ) : (
            <button type="button" className={styles.back} onClick={() => onSwitchQuiz('animals')}>
              <span aria-hidden>←</span> Back to the modern animal quiz
            </button>
          )}
        </motion.div>
        <motion.p className="eyebrow" variants={rise} initial="hidden" animate="show" custom={0}>
          {copy.eyebrow}
        </motion.p>
        <motion.h1 className={styles.title} variants={rise} initial="hidden" animate="show" custom={1}>
          {copy.headline.before} <em>{copy.headline.em}</em> {copy.headline.after}
        </motion.h1>
        <motion.p className={styles.lede} variants={rise} initial="hidden" animate="show" custom={2}>
          {copy.lede(animals.length)}
        </motion.p>

        <motion.div className={styles.actions} variants={rise} initial="hidden" animate="show" custom={3}>
          {resumeLabel ? (
            <>
              <button type="button" className={styles.cta} onClick={onStart}>
                {resumeLabel} <span aria-hidden>→</span>
              </button>
              <button type="button" className={styles.secondary} onClick={onRestart}>
                Start fresh
              </button>
            </>
          ) : (
            <button type="button" className={styles.cta} onClick={onStart} autoFocus>
              {copy.cta} <span aria-hidden>→</span>
            </button>
          )}
          <QuizCounter count={quizCount} variant="landing" />
        </motion.div>

        <motion.p className={styles.disclaimer} variants={rise} initial="hidden" animate="show" custom={4}>
          {copy.disclaimer}
        </motion.p>
      </div>

      <motion.footer
        className={styles.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
      >
        {copy.footer.map((line, i) => (
          <span key={line} className={styles.footerItem}>
            {i > 0 && (
              <span className={styles.dot} aria-hidden>
                ·
              </span>
            )}
            {line}
          </span>
        ))}
      </motion.footer>
    </main>
  );
}
