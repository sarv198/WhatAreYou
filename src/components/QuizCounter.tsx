import { AnimatePresence, motion } from 'motion/react';
import styles from './QuizCounter.module.css';

interface QuizCounterProps {
  count: number | null;
  variant: 'landing' | 'header';
  className?: string;
}

const formatter = new Intl.NumberFormat('en-US');

/** "1,284 Quiz Takers". Renders nothing until the count is known. */
export function QuizCounter({ count, variant, className }: QuizCounterProps) {
  return (
    <AnimatePresence>
      {count !== null && (
        <motion.p
          className={[styles.counter, styles[variant], className].filter(Boolean).join(' ')}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          aria-live="polite"
        >
          <span className={styles.pulse} aria-hidden />
          <motion.strong key={count} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {formatter.format(count)}
          </motion.strong>{' '}
          {count === 1 ? 'Quiz Taker' : 'Quiz Takers'}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
