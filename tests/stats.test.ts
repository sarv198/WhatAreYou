import { describe, expect, it } from 'vitest';
import { formatShare, MIN_COMPLETIONS_FOR_SHARE, summarizeShare } from '../src/lib/animalShare';
import { createMemoryStore, createStatsHandlers } from '../src/lib/statsService';

const valid = new Set(['tiger', 'orca']);
const get = (query = '') => new Request(`http://test/api/stats${query}`);
const post = (body: unknown) =>
  new Request('http://test/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('completion stats API', () => {
  it('returns the current total', async () => {
    const handlers = createStatsHandlers(createMemoryStore({ tiger: 30, orca: 11 }), valid);
    const res = await handlers.GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ total: 41 });
  });

  it('returns how many completions ended on a given animal', async () => {
    const handlers = createStatsHandlers(createMemoryStore({ tiger: 30, orca: 11 }), valid);
    expect(await (await handlers.GET(get('?animal=orca'))).json()).toEqual({ total: 41, animalCount: 11 });
    expect((await handlers.GET(get('?animal=dragon'))).status).toBe(400);
  });

  it('records a completion and the animal it ended on', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, valid);
    expect(await (await handlers.POST(post({ animalId: 'tiger' }))).json()).toEqual({ total: 1, animalCount: 1 });
    expect(await (await handlers.POST(post({ animalId: 'tiger' }))).json()).toEqual({ total: 2, animalCount: 2 });
    expect(await (await handlers.POST(post({ animalId: 'orca' }))).json()).toEqual({ total: 3, animalCount: 1 });
    expect(Object.fromEntries(store.byAnimal)).toEqual({ tiger: 2, orca: 1 });
  });

  it('rejects unknown animals and malformed bodies without counting them', async () => {
    const store = createMemoryStore();
    const handlers = createStatsHandlers(store, valid);
    expect((await handlers.POST(post({ animalId: 'dragon' }))).status).toBe(400);
    expect((await handlers.POST(post({}))).status).toBe(400);
    expect((await handlers.POST(post('not json'))).status).toBe(400);
    expect(await store.getTotal()).toBe(0);
  });

  it('reports unavailable when no storage is configured', async () => {
    const handlers = createStatsHandlers(null, valid);
    expect((await handlers.GET(get())).status).toBe(503);
    expect((await handlers.POST(post({ animalId: 'tiger' }))).status).toBe(503);
  });
});

describe('same-animal share', () => {
  it('stays hidden until there are enough completions to be meaningful', () => {
    expect(summarizeShare({ total: MIN_COMPLETIONS_FOR_SHARE - 1, animalCount: 20 }, 80)).toBeNull();
    expect(summarizeShare({ total: MIN_COMPLETIONS_FOR_SHARE, animalCount: 20 }, 80)).not.toBeNull();
  });

  it('excludes the user’s own completion', () => {
    // 201 completions including yours; 11 ended on your animal, 10 of them other people.
    expect(summarizeShare({ total: 201, animalCount: 11 }, 80)).toMatchObject({ kind: 'share', share: 10 / 200 });
  });

  it('recognises being the first person to get an animal', () => {
    expect(summarizeShare({ total: 500, animalCount: 1 }, 80)).toEqual({ kind: 'first' });
  });

  it('labels rarity relative to an even split across animals', () => {
    // An even split across 80 animals is 1.25%.
    expect(summarizeShare({ total: 1001, animalCount: 5 }, 80)).toMatchObject({ rarity: 'rare' });
    expect(summarizeShare({ total: 1001, animalCount: 13 }, 80)).toMatchObject({ rarity: 'typical' });
    expect(summarizeShare({ total: 1001, animalCount: 41 }, 80)).toMatchObject({ rarity: 'common' });
  });

  it('formats percentages readably', () => {
    expect(formatShare(0.004)).toBe('Less than 1%');
    expect(formatShare(0.038)).toBe('3.8%');
    expect(formatShare(0.05)).toBe('5%');
    expect(formatShare(0.237)).toBe('24%');
  });
});
