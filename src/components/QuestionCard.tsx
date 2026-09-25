import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Question } from '../types';
import styles from './QuestionCard.module.css';

interface QuestionCardProps {
  question: Question;
  number: number;
  selected: string | null;
  onAnswer: (optionId: string) => void;
}

const PICK_DELAY_MS = 280;

export function QuestionCard({ question, number, selected, onAnswer }: QuestionCardProps) {
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(timer.current);
  }, []);

  const choose = (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    timer.current = window.setTimeout(() => onAnswer(optionId), reduceMotion ? 0 : PICK_DELAY_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const index = Number.parseInt(e.key, 10) - 1;
      const option = question.options[index];
      if (option) {
        e.preventDefault();
        choose(option.id);
      } else if (e.key === 'Enter' && selected && document.activeElement === headingRef.current) {
        e.preventDefault();
        choose(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const compact = question.options.length > 4 && question.options.every((o) => o.label.length <= 30);
  const active = picked ?? selected;

  return (
    <motion.section
      className={styles.card}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -20, transition: { duration: 0.25 } }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby={`q-${question.id}`}
    >
      <p className={styles.number}>
        <span>Question {number}</span>
      </p>
      <h2 id={`q-${question.id}`} ref={headingRef} tabIndex={-1} className={styles.prompt}>
        {question.prompt}
      </h2>
      {question.kicker && <p className={styles.kicker}>{question.kicker}</p>}

      <div className={compact ? `${styles.options} ${styles.grid}` : styles.options} role="list">
        {question.options.map((option, i) => (
          <motion.button
            key={option.id}
            type="button"
            role="listitem"
            className={styles.option}
            data-active={active === option.id || undefined}
            data-dimmed={(picked && picked !== option.id) || undefined}
            aria-pressed={active === option.id}
            onClick={() => choose(option.id)}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.18 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.key} aria-hidden>
              {i + 1}
            </span>
            <span className={styles.label}>{option.label}</span>
            <span className={styles.arrow} aria-hidden>
              →
            </span>
          </motion.button>
        ))}
      </div>

      <p className={styles.hint} aria-hidden>
        Tip: press <kbd>1</kbd>–<kbd>{question.options.length}</kbd> to answer
        {selected ? (
          <>
            , <kbd>Enter</kbd> to keep your answer
          </>
        ) : null}
      </p>
    </motion.section>
  );
}
