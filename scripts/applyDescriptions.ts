/**
 * Applies the reviewed CSV from suggestDescriptions.ts to the database.
 * Dry run by default (no database access); pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/applyDescriptions.ts [file.csv]                       # preview
 *   npx tsx scripts/applyDescriptions.ts [file.csv] --apply               # write
 *   npx tsx scripts/applyDescriptions.ts [file.csv] --apply --skip-outside   # skip rows with outsideKnowledge = YES
 */
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import { loadEnv } from './ageRangeUtils';
import { stripHtml, validateDescriptionHtml } from './descriptionUtils';

loadEnv();

type Row = { id: string; title: string; outsideKnowledge?: string; changeLevel?: string; suggestedDescription?: string };

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const skipOutside = args.includes('--skip-outside');
  const file = args.find((a) => !a.startsWith('--')) ?? 'description-suggestions.csv';

  if (!fs.existsSync(file)) throw new Error(`CSV not found: ${file}`);
  const rows: Row[] = parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });

  const updates: { id: string; title: string; description: string }[] = [];
  const invalid: string[] = [];
  let blank = 0;
  let skippedOutside = 0;
  let unchanged = 0;

  for (const r of rows) {
    const value = (r.suggestedDescription ?? '').trim();
    if (!value) {
      blank++;
      continue;
    }
    const problem = validateDescriptionHtml(value);
    if (problem) {
      invalid.push(`${r.title}: ${problem}`);
      continue;
    }
    if (skipOutside && (r.outsideKnowledge ?? '').toUpperCase() === 'YES') {
      skippedOutside++;
      continue;
    }
    if (r.changeLevel === 'unchanged') {
      unchanged++;
      continue;
    }
    updates.push({ id: r.id, title: r.title, description: value });
  }

  console.log(
    `${rows.length} row(s): ${updates.length} to update, ${unchanged} unchanged, ${blank} blank (skipped), ${skippedOutside} outside-knowledge skipped, ${invalid.length} invalid.`
  );
  invalid.forEach((i) => console.log(`  invalid -> ${i}`));

  if (!apply) {
    updates.slice(0, 5).forEach((u) => console.log(`\n  ${u.title}\n    ${stripHtml(u.description).slice(0, 220)}…`));
    if (updates.length > 5) console.log(`\n  ...and ${updates.length - 5} more`);
    console.log('\nDry run only. Add --apply to write these to the database (run `npm run db:backup` first so you can restore the originals).');
    return;
  }

  const prisma = new PrismaClient();
  try {
    let done = 0;
    let missing = 0;
    for (const u of updates) {
      const res = await prisma.book.updateMany({ where: { id: u.id }, data: { description: u.description } });
      if (res.count === 0) missing++;
      else done++;
    }
    console.log(`✅ Updated ${done} description(s).${missing ? ` ${missing} id(s) not found.` : ''} Site pages refresh within a few minutes.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
