import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { ANIMALS } from './src/data/animals';
import { createMemoryStore, createStatsHandlers } from './src/lib/statsService';

/** Deterministic sample completions (roughly 700) so the stats UI is visible locally. */
function sampleCompletions(): Record<string, number> {
  return Object.fromEntries(
    ANIMALS.map((animal) => {
      let h = 2166136261;
      for (const ch of animal.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      return [animal.id, 2 + ((h >>> 0) % 15)];
    }),
  );
}

/**
 * Serves /api/stats during `npm run dev` with an in-memory store seeded with
 * sample data, using the same handlers as the deployed Vercel function.
 * Nothing here runs in production; counts reset when the dev server restarts.
 */
function devStatsApi(): Plugin {
  return {
    name: 'dev-stats-api',
    apply: 'serve',
    configureServer(server) {
      const handlers = createStatsHandlers(createMemoryStore(sampleCompletions()), new Set(ANIMALS.map((a) => a.id)));
      server.middlewares.use('/api/stats', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          // Connect strips the mount path, so req.url is just the query string part.
          const request = new Request(`http://localhost/api/stats${req.url === '/' ? '' : (req.url ?? '')}`, {
            method: req.method,
            headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const response =
            req.method === 'POST'
              ? await handlers.POST(request)
              : req.method === 'GET'
                ? await handlers.GET(request)
                : new Response(null, { status: 405 });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (err) {
          server.config.logger.error(`[dev-stats-api] ${(err as Error).stack ?? err}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devStatsApi()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
