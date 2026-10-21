#!/usr/bin/env tsx
/**
 * Copy the production catalog into your LOCAL database so local matches prod.
 *
 *   npm run db:sync-from-prod                       # books, categories, promo codes
 *   npm run db:sync-from-prod -- --include-orders   # also copies customer orders (emails, addresses!)
 *   npm run db:sync-from-prod -- --yes              # skip the confirmation prompt
 *
 * Production is only ever READ (pg_dump). What it does:
 *   1. refuses to run unless the local database is on localhost (so it can never wipe a hosted database)
 *   2. applies pending migrations to the local database (`prisma migrate deploy`) so the schema matches prod
 *   3. dumps the prod tables to a temp file
 *   4. in ONE transaction: clears local Book/Category/PromoCode data (this also clears local orders, scans,
 *      stock counts and anything else that points at books or promo codes), then imports the dump.
 *      If the import fails, nothing is cleared.
 *
 * Connection strings (never printed in full):
 *   prod : PROD_DATABASE_URL, or DATABASE_URL inside .env.production
 *   local: DATABASE_URL from the environment, or inside .env
 *
 * Needs the `psql` and `pg_dump` command-line tools (brew install postgresql@17). pg_dump must be the same
 * version as, or newer than, the production server.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

const args = new Set(process.argv.slice(2));
const includeOrders = args.has('--include-orders');
const skipPrompt = args.has('--yes');

function readEnvFileUrl(file: string): string | undefined {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return undefined;
  const match = fs.readFileSync(full, 'utf-8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  return match?.[1].trim();
}

const hide = (url: string) => url.replace(/:\/\/([^:@/]+):[^@]*@/, '://$1:***@');
const die = (message: string): never => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

const prodUrl = process.env.PROD_DATABASE_URL || readEnvFileUrl('.env.production');
const localUrl = process.env.DATABASE_URL || readEnvFileUrl('.env');
if (!prodUrl) die('No production URL. Set PROD_DATABASE_URL or put DATABASE_URL in .env.production');
if (!localUrl) die('No local URL. Set DATABASE_URL or put it in .env');

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return die('Could not read a database URL (expected postgresql://user:pass@host:port/db)');
  }
}
const localHost = hostOf(localUrl as string);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(localHost)) {
  die(`Your local DATABASE_URL points at "${localHost}", not localhost. Refusing to wipe it. Point DATABASE_URL at your local database.`);
}
if (prodUrl === localUrl) die('Production and local URLs are identical. Refusing to continue.');

const tables = ['"Book"', '"Category"', '"_BookCategories"', '"PromoCode"', ...(includeOrders ? ['"Order"'] : [])];
// Local tables that get cleared. CASCADE also clears tables that reference these (Order, Scan, StockCount).
const truncate = `TRUNCATE TABLE "_BookCategories", "Book", "Category", "PromoCode"${includeOrders ? ', "Order"' : ''} RESTART IDENTITY CASCADE;`;

function psql(extra: string[], stdio: 'inherit' | 'pipe' = 'inherit'): string {
  try {
    const out = execFileSync('psql', [localUrl as string, '-v', 'ON_ERROR_STOP=1', ...extra], { stdio: stdio === 'pipe' ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    return out ? out.toString() : '';
  } catch {
    // Not the original error: its message would contain the full command, including the database password
    throw new Error('psql failed. The reason is printed just above this line. Nothing local was changed.');
  }
}

/** Never show a connection string (it holds the password) in an error message. */
const scrub = (text: string) => text.replace(/postgres(?:ql)?:\/\/\S+/g, 'postgresql://***');

async function confirm(): Promise<void> {
  if (skipPrompt) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) =>
    rl.question(`\nThis will REPLACE the data in your local database (${hide(localUrl as string)}).\nType "yes" to continue: `, resolve)
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') die('Cancelled. Nothing was changed.');
}

async function main() {
  console.log('🔄 Syncing production data to your local database\n');
  console.log(`📦 Production (read-only): ${hide(prodUrl as string)}`);
  console.log(`💾 Local:                  ${hide(localUrl as string)}`);
  console.log(`🧾 Tables: ${tables.join(', ')}${includeOrders ? '  (includes customer orders)' : ''}`);
  await confirm();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-sync-'));
  const dumpFile = path.join(tmpDir, 'prod-data.sql');
  const wrapperFile = path.join(tmpDir, 'restore.sql');

  try {
    console.log('\n1️⃣  Applying migrations to the local database...');
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: localUrl } });

    console.log('\n2️⃣  Dumping production data (read-only)...');
    const fd = fs.openSync(dumpFile, 'w');
    try {
      execFileSync(
        'pg_dump',
        ['--data-only', '--no-owner', '--no-acl', '--column-inserts', ...tables.flatMap((t) => ['-t', `public.${t}`]), `--dbname=${prodUrl}`],
        { stdio: ['ignore', fd, 'pipe'] }
      );
    } catch (error) {
      const stderr = String((error as { stderr?: Buffer }).stderr ?? '');
      if (/server version mismatch/i.test(stderr)) {
        die(
          'pg_dump is older than the production server. Install a matching version, e.g. `brew install postgresql@17`, ' +
            'then run with it first on your PATH: PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" npm run db:sync-from-prod'
        );
      }
      console.error(stderr);
      die('Could not dump production data (see above). Nothing local was changed.');
    } finally {
      fs.closeSync(fd);
    }
    // A dump from Postgres 17 sets transaction_timeout, which older local servers reject. It is only a safety
    // timeout, so drop it and the same dump restores on any version.
    fs.writeFileSync(dumpFile, fs.readFileSync(dumpFile, 'utf-8').replace(/^SET transaction_timeout = 0;\r?\n/m, ''));
    console.log('✅ Dump complete');

    console.log('\n3️⃣  Replacing local data (one transaction: all or nothing)...');
    fs.writeFileSync(
      wrapperFile,
      [
        truncate,
        `\\i '${dumpFile.replace(/'/g, "''")}'`,
        // pg_dump clears search_path for its session; put it back before touching tables by name
        'SET search_path TO public;',
        // The dump inserts Category ids explicitly, so move the id counter past them
        `SELECT setval(pg_get_serial_sequence('"Category"', 'id'), COALESCE((SELECT MAX(id) FROM "Category"), 1));`,
      ].join('\n')
    );
    psql(['--single-transaction', '-q', '-o', os.devNull, '-f', wrapperFile]);
    console.log('✅ Local data replaced');

    console.log('\n📊 Local database now has:');
    const one = (sql: string) => psql(['-t', '-A', '-c', sql], 'pipe').trim();
    console.log(`   📚 Books:             ${one('SELECT COUNT(*) FROM "Book"')}`);
    console.log(`   🔢 Books with ISBN:   ${one('SELECT COUNT(*) FROM "Book" WHERE "isbn" IS NOT NULL')}`);
    console.log(`   🖼️  Books 2+ images:   ${one('SELECT COUNT(*) FROM "Book" WHERE array_length("images", 1) > 1')}`);
    console.log(`   🏷️  Categories:        ${one('SELECT COUNT(*) FROM "Category"')}`);
    console.log(`   🎟️  Promo codes:       ${one('SELECT COUNT(*) FROM "PromoCode"')}`);
    console.log(`   🧾 Orders:            ${one('SELECT COUNT(*) FROM "Order"')}${includeOrders ? '' : '  (cleared; use --include-orders to copy them)'}`);
    console.log('\n🎉 Done. Restart your dev server to clear Next.js caches.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌ Sync failed:', scrub(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
