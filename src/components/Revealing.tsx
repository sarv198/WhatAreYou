import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import styles from './Revealing.module.css';

interface RevealingProps {
  /** Final contenders, best match first. */
  contenders: string[];
  onDone: () => void;
}

const STEP_DELAYS = [140, 150, 170, 200, 250, 320, 420, 560];

/** A short, skippable drumroll before the result: the final contenders flicker past and settle. */
export function Revealing({ contenders, onDone }: RevealingProps) {
  const reduceMotion = useReducedMotion();
  const sequence = [...contenders.slice(1).reverse(), ...contenders.slice(1).reverse(), contenders[0]!].slice(
    -STEP_DELAYS.length,
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }
    if (step >= sequence.length - 1) {
      const t = window.setTimeout(onDone, 700);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), STEP_DELAYS[step] ?? 200);
    return () => window.clearTimeout(t);
  }, [step, sequence.length, onDone, reduceMotion]);

  const settled = step >= sequence.length - 1;

  return (
    <div className={styles.reveal} onClick={onDone}>
      <p className="eyebrow" role="status">
        {settled ? 'Found you' : 'Consulting the animal kingdom…'}
      </p>
      <div className={styles.slot} aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={step}
            className={styles.name}
            data-settled={settled || undefined}
            initial={{ y: '60%', opacity: 0, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: settled ? 1 : 0.7, filter: 'blur(0px)' }}
            exit={{ y: '-60%', opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.18 }}
          >
            {sequence[step]}
          </motion.span>
        </AnimatePresence>
      </div>
      <button type="button" className={styles.skip} onClick={onDone} autoFocus>
        Skip to my result
      </button>
    </div>
  );
}
