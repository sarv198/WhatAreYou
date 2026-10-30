import { describe, expect, it } from 'vitest';
import { formatShare, MIN_COMPLETIONS_FOR_SHARE, summarizeShare } from '../src/lib/animalShare';
import { buildCatalog, createMemoryStore, createStatsHandlers, findRedisCredentials, statsKeys } from '../src/lib/statsService';

describe('Redis credential lookup', () => {
  it('finds credentials that Vercel saved with a custom prefix', () => {
    expect(
      findRedisCredentials({
        animalquiz_KV_REST_API_TOKEN: 'write-token',
        animalquiz_KV_REST_API_READ_ONLY_TOKEN: 'read-only-token',
        animalquiz_KV_REST_API_URL: 'https://example.upstash.io',
        animalquiz_KV_URL: 'rediss://example',
        animalquiz_REDIS_URL: 'rediss://example',
      }),
    ).toEqual({ url: 'https://example.upstash.io', token: 'write-token' });
  });

  it('accepts the standard and manual-setup names', () => {
    expect(findRedisCredentials({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' })).toEqual({ url: 'u', token: 't' });
    expect(findRedisCredentials({ UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' })).toEqual({ url: 'u', token: 't' });
  });

  it('never uses the read-only token, and reports missing credentials', () => {
    expect(findRedisCredentials({ x_KV_REST_API_URL: 'u', x_KV_REST_API_READ_ONLY_TOKEN: 'ro' })).toBeNull();
    expect(findRedisCredentials({})).toBeNull();
  });
});

const valid = buildCatalog(
  [{ id: 'tiger' }, { id: 'orca' }],
  [
    { id: 'habitat', options: [{ id: 'ocean' }, { id: 'snow' }] },
    { id: 'rhythm', options: [{ id: 'night' }, { id: 'morning' }] },
  ],
);
const fossils = buildCatalog([{ id: 'trex' }, { id: 'orca' }], [{ id: 'legacy', options: [{ id: 'biggest' }] }]);
const catalogs = { animals: valid, prehistoric: fossils };
const get = (query = '') => new Request(`http://test/api/stats${query}`);
const post = (body: unknown) =>
  new Request('http://test/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('completion stats API', () => {
  it('returns the current total', async () => {
    const handlers = createStatsHandlers(createMemoryStore({ animals: { tiger: 30, orca: 11 } }), catalogs);
    const res = await handlers.GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 41 });
  });

  it('returns how many completions ended on a given animal', async () => {
    const handlers = createStatsHandlers(createMemoryStore({ animals: { tiger: 30, orca: 11 } }), catalogs);
    expect(await (await handlers.GET(get('?animal=orca'))).json()).toEqual({ total: 41, animalCount: 11 });
    expect((await handlers.GET(get('?animal=dragon'))).status).toBe(400);
  });

  it('records a completion and the animal it ended on', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    expect(await (await handlers.POST(post({ animalId: 'tiger' }))).json()).toEqual({ total: 1, animalCount: 1 });
    expect(await (await handlers.POST(post({ animalId: 'tiger' }))).json()).toEqual({ total: 2, animalCount: 2 });
    expect(await (await handlers.POST(post({ animalId: 'orca' }))).json()).toEqual({ total: 3, animalCount: 1 });
    expect(Object.fromEntries(store.byAnimal.get('animals')!)).toEqual({ tiger: 2, orca: 1 });
  });

  it('keeps each quiz separate', async () => {
    const store = createMemoryStore({ animals: { orca: 5 } });
    const handlers = createStatsHandlers(store, catalogs);
    expect(await (await handlers.POST(post({ quiz: 'prehistoric', animalId: 'orca' }))).json()).toEqual({ total: 1, animalCount: 1 });
    expect(await (await handlers.GET(get('?quiz=prehistoric&animal=trex'))).json()).toEqual({ total: 1, animalCount: 0 });
    expect(await (await handlers.GET(get('?quiz=animals'))).json()).toEqual({ total: 5 });
    // Animals and answers are validated against the named quiz.
    expect((await handlers.POST(post({ quiz: 'prehistoric', animalId: 'tiger' }))).status).toBe(400);
    expect((await handlers.POST(post({ quiz: 'prehistoric', animalId: 'trex', answers: [['habitat', 'ocean']] }))).status).toBe(400);
    expect((await handlers.POST(post({ quiz: 'prehistoric', animalId: 'trex', answers: [['legacy', 'biggest']] }))).status).toBe(200);
    expect(Object.fromEntries(store.answerCounts.get('prehistoric')!)).toEqual({ 'legacy:biggest': 1 });
    expect(store.answerCounts.get('animals')).toBeUndefined();
  });

  it('rejects unknown quizzes', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    expect((await handlers.GET(get('?quiz=dragons'))).status).toBe(400);
    expect((await handlers.GET(get('?quiz=__proto__'))).status).toBe(400);
    expect((await handlers.POST(post({ quiz: 'dragons', animalId: 'tiger' }))).status).toBe(400);
    expect((await handlers.POST(post({ quiz: 7, animalId: 'tiger' }))).status).toBe(400);
    expect(await store.getTotal('animals')).toBe(0);
  });

  it('keeps the original keys for the main quiz and namespaces the others', () => {
    expect(statsKeys('animals').total).toBe('quiz:completions');
    expect(statsKeys('prehistoric').byAnimal).toBe('prehistoric:completions:by-animal');
  });

  it('rejects unknown animals and malformed bodies without counting them', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    expect((await handlers.POST(post({ animalId: 'dragon' }))).status).toBe(400);
    expect((await handlers.POST(post({}))).status).toBe(400);
    expect((await handlers.POST(post('not json'))).status).toBe(400);
    expect((await handlers.POST(post('null'))).status).toBe(400);
    expect(await store.getTotal('animals')).toBe(0);
  });

  it('reports unavailable when no storage is configured', async () => {
    const handlers = createStatsHandlers(null, catalogs);
    expect((await handlers.GET(get())).status).toBe(503);
    expect((await handlers.POST(post({ animalId: 'tiger' }))).status).toBe(503);
  });

  it('records anonymous answer choices alongside a completion', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    const answers = [
      ['habitat', 'ocean'],
      ['rhythm', 'night'],
    ];
    expect((await handlers.POST(post({ animalId: 'orca', answers }))).status).toBe(200);
    expect((await handlers.POST(post({ animalId: 'tiger', answers: [['habitat', 'ocean']] }))).status).toBe(200);

    expect(Object.fromEntries(store.answerCounts.get('animals')!)).toEqual({ 'habitat:ocean': 2, 'rhythm:night': 1 });
    const log = store.answerLogs.get('animals')!;
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ a: 'orca', r: answers });
    expect(log[1]!.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('still accepts completions from older clients that send no answers', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    expect((await handlers.POST(post({ animalId: 'orca' }))).status).toBe(200);
    expect(await store.getTotal('animals')).toBe(1);
    expect(store.answerLogs.size).toBe(0);
  });

  it('rejects answers that do not match the question bank, and counts nothing', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, catalogs);
    const bad = [
      [['habitat', 'moon']],
      [['colour', 'blue']],
      [['habitat', 'ocean'], ['habitat', 'snow']],
      [],
      'habitat:ocean',
      [['habitat']],
      Array.from({ length: 3 }, () => ['habitat', 'ocean']),
    ];
    for (const answers of bad) {
      expect((await handlers.POST(post({ animalId: 'orca', answers }))).status).toBe(400);
    }
    expect(await store.getTotal('animals')).toBe(0);
    expect(store.answerCounts.size).toBe(0);
  });
});

describe('same-animal share', () => {
  it('always reports the raw count, but only adds a percentage once it is meaningful', () => {
    expect(summarizeShare({ total: 13, animalCount: 3 }, 80)).toMatchObject({ sameAnimal: 2, others: 12, showPercent: false, rarity: null });
    expect(summarizeShare({ total: MIN_COMPLETIONS_FOR_SHARE - 1, animalCount: 20 }, 80).showPercent).toBe(false);
    expect(summarizeShare({ total: MIN_COMPLETIONS_FOR_SHARE, animalCount: 20 }, 80).showPercent).toBe(true);
  });

  it('excludes the user’s own completion', () => {
    // 201 completions including yours; 11 ended on your animal, 10 of them other people.
    expect(summarizeShare({ total: 201, animalCount: 11 }, 80)).toMatchObject({ sameAnimal: 10, others: 200, share: 10 / 200 });
  });

  it('handles being the first to get an animal, and the first to take the quiz at all', () => {
    expect(summarizeShare({ total: 500, animalCount: 1 }, 80)).toMatchObject({ sameAnimal: 0, others: 499 });
    expect(summarizeShare({ total: 1, animalCount: 1 }, 80)).toMatchObject({ sameAnimal: 0, others: 0, share: null, showPercent: false });
  });

  it('labels rarity relative to an even split across animals', () => {
    // An even split across 80 animals is 1.25%.
    expect(summarizeShare({ total: 1001, animalCount: 5 }, 80)).toMatchObject({ rarity: 'rare' });
    expect(summarizeShare({ total: 1001, animalCount: 13 }, 80)).toMatchObject({ rarity: 'typical' });
    expect(summarizeShare({ total: 1001, animalCount: 41 }, 80)).toMatchObject({ rarity: 'common' });
  });

  it('formats percentages readably', () => {
    expect(formatShare(0.004)).toBe('less than 1%');
    expect(formatShare(0.038)).toBe('3.8%');
    expect(formatShare(0.05)).toBe('5%');
    expect(formatShare(0.237)).toBe('24%');
  });
});
