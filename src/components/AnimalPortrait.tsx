import { useState, type CSSProperties } from 'react';
import { useAnimalImage } from '../hooks/useAnimalImage';
import type { AnimalProfile } from '../types';
import styles from './AnimalPortrait.module.css';

interface AnimalPortraitProps {
  animal: AnimalProfile;
  className?: string;
}

/** A photo from Wikipedia over an illustrated fallback, so there's always something beautiful to see. */
export function AnimalPortrait({ animal, className }: AnimalPortraitProps) {
  const { image } = useAnimalImage(animal.wikiTitle);
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const activeSrc = src ?? image?.src ?? null;
  const showPhoto = !!image && !failed && !!activeSrc;

  return (
    <figure
      className={[styles.portrait, className].filter(Boolean).join(' ')}
      style={{ '--accent': animal.color } as CSSProperties}
    >
      <div className={styles.frame}>
        <div className={styles.art} aria-hidden>
          <svg className={styles.contours} viewBox="0 0 200 260" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 9 }, (_, i) => (
              <ellipse key={i} cx="100" cy="150" rx={20 + i * 16} ry={14 + i * 13} />
            ))}
          </svg>
          <span className={styles.monogram}>{animal.name.charAt(0)}</span>
        </div>
        {showPhoto && (
          <img
            className={styles.photo}
            data-loaded={loaded || undefined}
            src={activeSrc}
            alt={`A ${animal.name.toLowerCase()}`}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (image && activeSrc !== image.fallbackSrc) setSrc(image.fallbackSrc);
              else setFailed(true);
            }}
          />
        )}
        <div className={styles.vignette} aria-hidden />
      </div>
      {showPhoto && loaded && image && (
        <figcaption className={styles.credit}>
          Photo via{' '}
          <a href={image.pageUrl} target="_blank" rel="noreferrer">
            Wikipedia
          </a>
        </figcaption>
      )}
    </figure>
  );
}
