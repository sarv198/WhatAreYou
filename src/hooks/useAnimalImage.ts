import { useEffect, useState } from 'react';

export interface AnimalImage {
  src: string;
  fallbackSrc: string;
  pageUrl: string;
}

const CACHE_KEY = 'what-animal-are-you:images:v1';
const memoryCache = new Map<string, AnimalImage | null>();

function readCache(): Record<string, AnimalImage | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeCache(title: string, image: AnimalImage | null) {
  memoryCache.set(title, image);
  // Failures may be transient (rate limits, offline), so only successes persist.
  if (!image) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [title]: image }));
  } catch {
    // Cache is a nicety only.
  }
}

async function fetchImage(title: string, signal: AbortSignal): Promise<AnimalImage | null> {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const thumb: string | undefined = data?.thumbnail?.source;
  if (!thumb) return null;
  return {
    // Wikimedia serves thumbnails in fixed size buckets; 960px is one of them.
    src: thumb.replace(/\/\d+px-/, '/960px-'),
    fallbackSrc: thumb,
    pageUrl: data?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

/** Fetches a photo for an animal from Wikipedia. Resolves to null when unavailable. */
export function useAnimalImage(title: string | undefined) {
  const [image, setImage] = useState<AnimalImage | null | undefined>(() =>
    title ? memoryCache.get(title) ?? readCache()[title] : null,
  );

  useEffect(() => {
    if (!title) {
      setImage(null);
      return;
    }
    const cached = memoryCache.has(title) ? memoryCache.get(title) : readCache()[title];
    if (cached !== undefined) {
      setImage(cached);
      return;
    }
    setImage(undefined);
    const controller = new AbortController();
    fetchImage(title, controller.signal)
      .then((result) => {
        writeCache(title, result);
        setImage(result);
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setImage(null);
      });
    return () => controller.abort();
  }, [title]);

  return { image, loading: image === undefined };
}
