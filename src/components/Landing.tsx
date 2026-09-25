import { motion } from 'motion/react';
import type { AnimalProfile } from '../types';
import { Field } from './Field';
import styles from './Landing.module.css';

interface LandingProps {
  animals: readonly AnimalProfile[];
  onStart: () => void;
  onRestart: () => void;
  resumeLabel: string | null;
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Landing({ animals, onStart, onRestart, resumeLabel }: LandingProps) {
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
        <motion.p className="eyebrow" variants={rise} initial="hidden" animate="show" custom={0}>
          A field guide to you
        </motion.p>
        <motion.h1 className={styles.title} variants={rise} initial="hidden" animate="show" custom={1}>
          What <em>animal</em> are&nbsp;you?
        </motion.h1>
        <motion.p className={styles.lede} variants={rise} initial="hidden" animate="show" custom={2}>
          {animals.length} animals. A handful of questions. We’ll figure it out.
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
              Find my animal <span aria-hidden>→</span>
            </button>
          )}
        </motion.div>

        <motion.p className={styles.disclaimer} variants={rise} initial="hidden" animate="show" custom={4}>
          No astrology. No nonsense. Just vibes, instincts, and questionable methodology.
        </motion.p>
      </div>

      <motion.footer
        className={styles.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
      >
        <span>Adaptive: every answer changes the next question</span>
        <span className={styles.dot} aria-hidden>·</span>
        <span>Usually 9–13 questions</span>
        <span className={styles.dot} aria-hidden>·</span>
        <span>About two minutes</span>
      </motion.footer>
    </main>
  );
}
