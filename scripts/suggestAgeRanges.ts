/**
 * Suggests an age range for each book using Claude and writes a CSV for review.
 * Does NOT modify the database. After reviewing/editing the CSV, run applyAgeRanges.ts.
 *
 * Usage:
 *   npx tsx scripts/suggestAgeRanges.ts            # only books without an ageRange
 *   npx tsx scripts/suggestAgeRanges.ts --all      # every book (overwrites suggestions for existing too)
 *   npx tsx scripts/suggestAgeRanges.ts --out my.csv
 */
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { csvEscape, isValidAgeRange, loadEnv, normalizeAgeRange } from './ageRangeUtils';

loadEnv();

const BATCH_SIZE = 10;
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';

const TOOL: Anthropic.Tool = {
  name: 'record_age_ranges',
  description: 'Record the suggested reader age range for each book.',
  input_schema: {
    type: 'object',
    properties: {
      books: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The book id exactly as given.' },
            ageRange: {
              type: 'string',
              description: 'Format "N-M" (e.g. "6-9", "10-13"), "N+" (e.g. "14+", "18+"), or "All ages".',
            },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reason: { type: 'string', description: 'One short sentence.' },
          },
          required: ['id', 'ageRange', 'confidence', 'reason'],
        },
      },
    },
    required: ['books'],
  },
};

const SYSTEM = `You classify books from an Islamic bookstore by the age of the intended reader.
Rules:
- Use only these formats: "N-M" (e.g. "3-5", "6-9", "10-13", "14-17"), "N+" (e.g. "14+", "18+"), or "All ages".
- Picture books and early readers: 3-5 or 6-9. Middle-grade stories: 8-12 or 10-13. Teen books: 13+ or 14-17.
- Adult scholarly, theological, fiqh, tafsir, history or self-help books: "18+" (or "16+" for accessible general-audience books).
- "All ages" only for books explicitly meant for families to share across ages, or reference items such as a Quran or duas book usable by any age.
- Base your answer only on the title, author, categories and description. Keep ranges realistic and no wider than about 5 years for children's books.
- If the information is thin, give your best estimate with "low" confidence.`;

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'age-range-suggestions.csv';

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (add it to .env).');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (add it to .env).');

  const prisma = new PrismaClient();
  const client = new Anthropic();

  try {
    const books = await prisma.book.findMany({
      where: all ? undefined : { ageRange: null },
      include: { categories: true },
      orderBy: { title: 'asc' },
    });
    console.log(`Found ${books.length} book(s) to classify using ${MODEL}.`);
    if (books.length === 0) return;

    const byId = new Map(books.map((b) => [b.id, b]));
    const rows: string[][] = [];
    const missed: string[] = [];

    for (let i = 0; i < books.length; i += BATCH_SIZE) {
      const batch = books.slice(i, i + BATCH_SIZE);
      const payload = batch.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        categories: b.categories.map((c) => c.name),
        description: b.description.slice(0, 600),
      }));

      let result: { id: string; ageRange: string; confidence: string; reason: string }[] = [];
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2000,
          system: SYSTEM,
          tools: [TOOL],
          messages: [{ role: 'user', content: `Classify these books, then call ${TOOL.name} with every book (do not reply in plain text):\n${JSON.stringify(payload, null, 2)}` }],
        });
        const block = res.content.find((c) => c.type === 'tool_use');
        if (block && block.type === 'tool_use') {
          result = ((block.input as { books?: typeof result }).books ?? []);
        }
      } catch (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error instanceof Error ? error.message : error);
      }

      const seen = new Set<string>();
      for (const r of result) {
        const book = byId.get(r.id);
        if (!book || seen.has(r.id) || !isValidAgeRange(r.ageRange ?? '')) continue;
        seen.add(r.id);
        rows.push([book.id, book.title, book.author, book.ageRange ?? '', normalizeAgeRange(r.ageRange), r.confidence, r.reason]);
      }
      for (const b of batch) if (!seen.has(b.id)) missed.push(b.title);
      console.log(`Processed ${Math.min(i + BATCH_SIZE, books.length)}/${books.length}`);
    }

    const header = ['id', 'title', 'author', 'currentAgeRange', 'suggestedAgeRange', 'confidence', 'reason'];
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
    fs.writeFileSync(outFile, csv);

    const low = rows.filter((r) => r[5] === 'low').length;
    console.log(`\nWrote ${rows.length} suggestion(s) to ${outFile} (${low} low-confidence).`);
    if (missed.length > 0) {
      console.log(`${missed.length} book(s) got no valid suggestion — re-run to retry them:`);
      missed.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
    }
    console.log('Review/edit the "suggestedAgeRange" column, then run: npx tsx scripts/applyAgeRanges.ts --apply');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
