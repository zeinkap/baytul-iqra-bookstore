/**
 * Runs `prisma migrate deploy`, but only for Vercel production builds.
 *
 * Preview builds (every PR branch) share the production DATABASE_URL, so migrating there would
 * change the live database before a PR is merged, and parallel builds can fight over Prisma's
 * migration lock (P1002). Production deploys run once per merge, so they are safe.
 *
 * Locally, run migrations yourself: `npm run db:migrate` (dev) or `npx prisma migrate deploy`.
 * Two production builds close together (e.g. a merge then a quick follow-up push) can still collide, so a
 * lock timeout is retried a few times before the build fails.
 * To force it anywhere (e.g. another CI), set MIGRATE_ON_BUILD=1.
 */
import { spawnSync } from 'node:child_process';

const shouldMigrate = process.env.VERCEL_ENV === 'production' || process.env.MIGRATE_ON_BUILD === '1';

if (!shouldMigrate) {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}; only runs for production builds).`);
  process.exit(0);
}

console.log('Production build: applying database migrations...');
const MAX_ATTEMPTS = 4;
const RETRY_WAIT_MS = 15_000;

for (let attempt = 1; ; attempt++) {
  // Output is captured (to spot the lock timeout) and echoed so the build log still shows everything
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { encoding: 'utf8' });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status === 0) break;

  // Only the lock timeout is worth retrying: another build is migrating, or the database is waking up.
  // Anything else (a failing migration, a bad connection string) would fail the same way again.
  const lockTimeout = /P1002|advisory lock/i.test(`${result.stdout}${result.stderr}`);
  if (attempt >= MAX_ATTEMPTS || !lockTimeout) {
    console.error('prisma migrate deploy failed');
    process.exit(result.status ?? 1);
  }
  console.log(`Migration lock busy (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_WAIT_MS / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
}
