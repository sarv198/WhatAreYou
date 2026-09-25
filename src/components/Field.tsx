import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import type { CandidateScore } from '../lib/scoring';
import type { AnimalClass, AnimalProfile } from '../types';
import styles from './Field.module.css';

export const CLASS_COLORS: Record<AnimalClass, string> = {
  reptile: '#d2ad5a',
  amphibian: '#a4cc72',
  bird: '#86b7e0',
  mammal: '#e6c396',
  fish: '#63c2b8',
  invertebrate: '#e98a72',
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Stable per-id hash so each animal keeps its spot even when animals are added. */
function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function layout(animals: readonly AnimalProfile[], radius: number) {
  const order = [...animals].sort((a, b) => hash(a.id) - hash(b.id));
  const spacing = radius / Math.sqrt(order.length + 0.5);
  return new Map(
    order.map((animal, i) => {
      const r = spacing * Math.sqrt(i + 0.5);
      const theta = i * GOLDEN_ANGLE;
      return [animal.id, { x: r * Math.cos(theta), y: r * Math.sin(theta) }];
    }),
  );
}

export type FieldMode = 'idle' | 'quiz' | 'result';

interface FieldProps {
  animals: readonly AnimalProfile[];
  scores?: readonly CandidateScore[];
  poolIds?: ReadonlySet<string>;
  mode: FieldMode;
  winnerId?: string;
  className?: string;
  label?: string;
}

export function Field({ animals, scores, poolIds, mode, winnerId, className, label }: FieldProps) {
  const reduceMotion = useReducedMotion();
  const positions = useMemo(() => layout(animals, 180), [animals]);
  const byId = useMemo(() => new Map(scores?.map((s) => [s.animal.id, s])), [scores]);
  const maxP = scores?.[0]?.probability ?? 1;

  const constellation = useMemo(() => {
    if (mode !== 'quiz' || !scores || !poolIds || poolIds.size > 9 || poolIds.size < 2) return null;
    return scores
      .filter((s) => poolIds.has(s.animal.id))
      .map((s) => positions.get(s.animal.id)!)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [mode, scores, poolIds, positions]);

  const secondary = useMemo(() => new Set(scores?.slice(1, 5).map((s) => s.animal.id)), [scores]);

  return (
    <svg
      className={[styles.field, className].filter(Boolean).join(' ')}
      viewBox="-200 -200 400 400"
      role="img"
      aria-label={label ?? `${animals.length} animals`}
    >
      <defs>
        <radialGradient id="field-halo">
          <stop offset="0%" stopColor="rgba(217,179,108,0.14)" />
          <stop offset="100%" stopColor="rgba(217,179,108,0)" />
        </radialGradient>
        <filter id="field-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle r="196" fill="url(#field-halo)" />
      <circle r="190" className={styles.orbit} />
      <circle r="120" className={styles.orbit} />
      <circle r="55" className={styles.orbit} />

      <g className={mode === 'idle' && !reduceMotion ? styles.spinSlow : styles.spinSlower}>
        {constellation && (
          <motion.polyline
            key={constellation}
            points={constellation}
            className={styles.constellation}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.2, ease: 'easeOut' }}
          />
        )}
        {animals.map((animal, i) => {
          const { x, y } = positions.get(animal.id)!;
          const color = CLASS_COLORS[animal.animalClass];
          const score = byId.get(animal.id);
          let r = 3.4;
          let opacity = 0.75;
          let glow = false;

          if (mode === 'quiz' && score) {
            const inPool = poolIds?.has(animal.id) ?? true;
            const share = Math.sqrt(score.probability / maxP);
            r = inPool ? 2.8 + 7.5 * share : 1.6;
            opacity = inPool ? 0.45 + 0.55 * share : 0.14;
            glow = inPool && share > 0.55;
          } else if (mode === 'result') {
            const isWinner = animal.id === winnerId;
            r = isWinner ? 11 : secondary.has(animal.id) ? 3.2 : 1.6;
            opacity = isWinner ? 1 : secondary.has(animal.id) ? 0.5 : 0.12;
            glow = isWinner;
          }

          return (
            <g key={animal.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
              {glow && (
                <motion.circle
                  fill={color}
                  filter="url(#field-glow)"
                  initial={false}
                  animate={{ r: r * 1.9, opacity: opacity * 0.55 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <motion.circle
                fill={color}
                className={mode === 'idle' ? styles.twinkle : undefined}
                style={mode === 'idle' ? { animationDelay: `${(i * 0.37) % 6}s` } : undefined}
                initial={false}
                animate={{ r, opacity }}
                transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : (i % 13) * 0.012 }}
              />
              {mode === 'result' && animal.id === winnerId && !reduceMotion && (
                <circle r={r} className={styles.pulse} stroke={color} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
