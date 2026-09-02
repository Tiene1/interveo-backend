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
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
