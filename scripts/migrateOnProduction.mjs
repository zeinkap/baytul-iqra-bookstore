/**
 * Runs `prisma migrate deploy`, but only for Vercel production builds.
 *
 * Preview builds (every PR branch) share the production DATABASE_URL, so migrating there would
 * change the live database before a PR is merged, and parallel builds can fight over Prisma's
 * migration lock (P1002). Production deploys run once per merge, so they are safe.
 *
 * Locally, run migrations yourself: `npm run db:migrate` (dev) or `npx prisma migrate deploy`.
 * To force it anywhere (e.g. another CI), set MIGRATE_ON_BUILD=1.
 */
import { execSync } from 'node:child_process';

const shouldMigrate = process.env.VERCEL_ENV === 'production' || process.env.MIGRATE_ON_BUILD === '1';

if (!shouldMigrate) {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}; only runs for production builds).`);
  process.exit(0);
}

console.log('Production build: applying database migrations...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });
