/**
 * Applies the reviewed CSV from suggestPrices.ts to the database.
 * Dry run by default (no database access); pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/applyPrices.ts [file.csv]                    # preview (default: newest price-suggestions-*.csv)
 *   npx tsx scripts/applyPrices.ts [file.csv] --apply            # write
 *   npx tsx scripts/applyPrices.ts [file.csv] --apply --skip-low # ignore low-confidence rows
 *   npx tsx scripts/applyPrices.ts [file.csv] --only online      # or: --only in-person
 *
 * Reads the "suggestedOnlinePrice" and "suggestedInPersonPrice" columns (edit them in the CSV; a blank cell means
 * "leave this price alone"). In-person prices must be whole dollars and not above the online price.
 * Run `npm run db:backup` first. The storefront cache can show the old online price for up to 5 minutes.
 */
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import { loadEnv } from './ageRangeUtils';
import { isWholeDollar } from './priceUtils';

loadEnv();

type Row = {
  id: string;
  title: string;
  confidence?: string;
  currentOnlinePrice?: string;
  currentInPersonPrice?: string;
  suggestedOnlinePrice?: string;
  suggestedInPersonPrice?: string;
};

const num = (v: string | undefined) => {
  const s = (v ?? '').trim().replace(/^\$/, '');
  return s === '' ? null : Number(s);
};

function newestSuggestionFile(): string | undefined {
  return fs
    .readdirSync('.')
    .filter((f) => /^price-suggestions-.*\.csv$/.test(f))
    .sort()
    .pop();
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const skipLow = args.includes('--skip-low');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
  if (only && only !== 'online' && only !== 'in-person') throw new Error('--only must be "online" or "in-person".');
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only');
  const file = positional[0] ?? newestSuggestionFile();

  if (!file || !fs.existsSync(file)) throw new Error(`CSV not found: ${file ?? 'no price-suggestions-*.csv in this folder'}`);
  const rows: Row[] = parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  console.log(`Reading ${file}`);

  type Update = { id: string; title: string; price?: { from: number | null; to: number }; inShopPrice?: { from: number | null; to: number } };
  const updates: Update[] = [];
  const invalid: string[] = [];
  let unchanged = 0;
  let skippedLow = 0;

  for (const r of rows) {
    if (skipLow && r.confidence === 'low') {
      skippedLow++;
      continue;
    }
    const currentOnline = num(r.currentOnlinePrice);
    const currentInPerson = num(r.currentInPersonPrice);
    const online = only === 'in-person' ? null : num(r.suggestedOnlinePrice);
    const inPerson = only === 'online' ? null : num(r.suggestedInPersonPrice);
    if (online == null && inPerson == null) continue;

    if (online != null && !(Number.isFinite(online) && online > 0)) {
      invalid.push(`${r.title}: online price "${r.suggestedOnlinePrice}" is not a positive number`);
      continue;
    }
    if (inPerson != null && !(Number.isFinite(inPerson) && isWholeDollar(inPerson) && inPerson > 0)) {
      invalid.push(`${r.title}: in-person price "${r.suggestedInPersonPrice}" must be a whole dollar amount`);
      continue;
    }
    const finalOnline = online ?? currentOnline;
    if (inPerson != null && finalOnline != null && inPerson > finalOnline) {
      invalid.push(`${r.title}: in-person $${inPerson} is above the online price $${finalOnline.toFixed(2)}`);
      continue;
    }

    const u: Update = { id: r.id, title: r.title };
    if (online != null && online !== currentOnline) u.price = { from: currentOnline, to: Math.round(online * 100) / 100 };
    if (inPerson != null && inPerson !== currentInPerson) u.inShopPrice = { from: currentInPerson, to: inPerson };
    if (!u.price && !u.inShopPrice) {
      unchanged++;
      continue;
    }
    updates.push(u);
  }

  console.log(`${rows.length} row(s): ${updates.length} to update, ${unchanged} unchanged, ${skippedLow} low-confidence skipped, ${invalid.length} invalid.`);
  invalid.forEach((i) => console.log(`  invalid -> ${i}`));

  const money = (n: number | null) => (n == null ? '—' : `$${n.toFixed(2)}`);
  const describe = (u: Update) =>
    [u.price && `online ${money(u.price.from)} -> ${money(u.price.to)}`, u.inShopPrice && `in-person ${money(u.inShopPrice.from)} -> ${money(u.inShopPrice.to)}`]
      .filter(Boolean)
      .join(', ');

  if (!apply) {
    updates.slice(0, 25).forEach((u) => console.log(`  ${u.title}: ${describe(u)}`));
    if (updates.length > 25) console.log(`  ...and ${updates.length - 25} more`);
    console.log('\nDry run only. Add --apply to write these to the database (run `npm run db:backup` first).');
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (add it to .env).');
  const prisma = new PrismaClient();
  try {
    let done = 0;
    let missing = 0;
    for (const u of updates) {
      const res = await prisma.book.updateMany({
        where: { id: u.id },
        data: { ...(u.price && { price: u.price.to }), ...(u.inShopPrice && { inShopPrice: u.inShopPrice.to }) },
      });
      if (res.count === 0) missing++;
      else done++;
    }
    console.log(`✅ Updated ${done} book(s).${missing ? ` ${missing} id(s) not found.` : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
