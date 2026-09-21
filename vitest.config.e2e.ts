import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Les suites e2e demarrent chacune une app Nest connectee au meme
    // PostgreSQL. On les execute en serie, dans un seul process, pour eviter
    // la pression sur le pool de connexions et le cold-start Prisma en parallele.
    pool: 'forks',
    fileParallelism: false,
    singleFork: true,
    // Les suites e2e ferment chacune leur app Nest ; pas besoin d'isoler le
    // module graph entre fichiers, ce qui evite de re-importer NestJS + le
    // client Prisma genere pour chaque suite (import qui explosait a 2 min).
    isolate: false,
    hookTimeout: 30000,
    testTimeout: 15000,
    // Les suites se connectent beaucoup depuis la meme IP : limite de debit de
    // POST /auth/login relevee, sauf dans rate-limit.e2e-spec.ts qui la teste.
    env: { LOGIN_RATE_LIMIT_PER_MINUTE: '1000' },
  },
});
