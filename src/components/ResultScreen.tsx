import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { QuizResult } from '../lib/resultGenerator';
import type { CandidateScore } from '../lib/scoring';
import type { AnimalProfile } from '../types';
import { AnimalPortrait } from './AnimalPortrait';
import { Field } from './Field';
import styles from './ResultScreen.module.css';

interface ResultScreenProps {
  result: QuizResult;
  animals: readonly AnimalProfile[];
  scores: readonly CandidateScore[];
  onRestart: () => void;
  onBack: () => void;
}

function article(name: string): 'a' | 'an' {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

export function ResultScreen({ result, animals, scores, onRestart, onBack }: ResultScreenProps) {
  const reduceMotion = useReducedMotion();
  const { animal } = result;
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    const previous = document.title;
    document.title = `I’m ${article(animal.name)} ${animal.name} — What Animal Are You?`;
    window.scrollTo({ top: 0 });
    return () => {
      document.title = previous;
    };
  }, [animal.name]);

  const rise = useMemo(
    () => ({
      hidden: { opacity: 0, y: reduceMotion ? 0 : 26 },
      show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: reduceMotion ? 0 : 0.1 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
      }),
    }),
    [reduceMotion],
  );

  const share = async () => {
    const text = `I’m ${article(animal.name)} ${animal.name} ${animal.emoji} — ${animal.tagline}. What animal are you?`;
    const url = window.location.href.split('#')[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'What animal are you?', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareState('copied');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setShareState('failed');
    }
    window.setTimeout(() => setShareState('idle'), 2400);
  };

  return (
    <main className={styles.result} style={{ '--accent': animal.color } as CSSProperties}>
      <div className={styles.glow} aria-hidden />

      <section className={styles.hero}>
        <motion.div className={styles.portraitCol} variants={rise} initial="hidden" animate="show" custom={2}>
          <AnimalPortrait animal={animal} />
        </motion.div>

        <div className={styles.heroHead}>
          <motion.p className={styles.youAre} variants={rise} initial="hidden" animate="show" custom={0}>
            You are {article(animal.name)}…
          </motion.p>
          <motion.h1 className={styles.name} variants={rise} initial="hidden" animate="show" custom={1}>
            {animal.name} <span className={styles.emoji}>{animal.emoji}</span>
          </motion.h1>
          <motion.p className={styles.tagline} variants={rise} initial="hidden" animate="show" custom={2}>
            {animal.tagline}
          </motion.p>
        </div>

        <div className={styles.heroBody}>
          <motion.ul className={styles.traits} variants={rise} initial="hidden" animate="show" custom={3}>
            {animal.traits.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </motion.ul>
          <motion.p className={styles.description} variants={rise} initial="hidden" animate="show" custom={4}>
            {animal.description}
          </motion.p>
          <motion.div className={styles.strength} variants={rise} initial="hidden" animate="show" custom={5}>
            <span className={styles.strengthValue}>{result.matchStrength}</span>
            <span className={styles.strengthLabel}>
              match strength
              <small>out of 100 · vibes-based</small>
            </span>
          </motion.div>
        </div>
      </section>

      <section className={styles.cards}>
        <motion.article className={`${styles.card} ${styles.why}`} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={0}>
          <h2>Why you matched</h2>
          <p className={styles.explanation}>{result.explanation}</p>
          {result.keyAnswers.length > 0 && (
            <>
              <h3 className="eyebrow">The answers that gave you away</h3>
              <ol className={styles.keyAnswers}>
                {result.keyAnswers.map((k) => (
                  <li key={k.question.id}>
                    <span className={styles.keyQuestion}>{k.question.prompt}</span>
                    <span className={styles.keyAnswer}>“{k.option.label}”</span>
                    <span className={styles.keyTags}>
                      {k.traitLabels.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </motion.article>

        <motion.article className={`${styles.card} ${styles.matches}`} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={1}>
          <h2>Your closest matches</h2>
          <ol className={styles.matchList}>
            {result.matches.map((m, i) => (
              <li key={m.animal.id} data-winner={i === 0 || undefined}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.matchEmoji} aria-hidden>
                  {m.animal.emoji}
                </span>
                <span className={styles.matchName}>{m.animal.name}</span>
                <span className={styles.matchScore}>{m.matchStrength}% similarity</span>
                <span className={styles.bar} aria-hidden>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: m.matchStrength / 100 }}
                    viewport={{ once: true }}
                    transition={{ delay: reduceMotion ? 0 : 0.2 + i * 0.08, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            A playful personality model, not science. Similarity scores are for fun — please don’t put them on your CV.
          </p>
        </motion.article>

        <motion.article className={`${styles.card} ${styles.notes}`} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={2}>
          <h2>Field notes</h2>
          <div className={styles.fieldMini}>
            <Field animals={animals} scores={scores} mode="result" winnerId={animal.id} label={`${animal.name}, out of ${animals.length} animals`} />
          </div>
          <p className={styles.oneOf}>
            One of {result.animalsConsidered}. Found in {result.questionsAsked} questions.
          </p>
          <dl className={styles.facts}>
            <dt>Strengths</dt>
            <dd>{animal.strengths.join(' · ')}</dd>
            <dt>Did you know?</dt>
            <dd>{animal.funFact}</dd>
          </dl>
        </motion.article>
      </section>

      <motion.nav className={styles.actions} aria-label="What next" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 1 }}>
        <button type="button" className={styles.primary} onClick={share}>
          {shareState === 'copied' ? 'Copied to clipboard' : shareState === 'failed' ? 'Couldn’t share' : 'Share my animal'}
        </button>
        <button type="button" className={styles.secondary} onClick={onRestart}>
          Take it again
        </button>
        <button type="button" className={styles.link} onClick={onBack}>
          ← Change my last answer
        </button>
      </motion.nav>
    </main>
  );
}
