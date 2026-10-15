/**
 * Suggests improved book descriptions using Claude and writes a CSV for review.
 * Does NOT modify the database. After reviewing/editing the CSV, run applyDescriptions.ts.
 *
 * Usage:
 *   npx tsx scripts/suggestDescriptions.ts                 # all books
 *   npx tsx scripts/suggestDescriptions.ts --limit 10      # try a small sample first
 *   npx tsx scripts/suggestDescriptions.ts --out my.csv
 *
 * Tip: run the age range scripts first so the opening sentence can mention the reader age.
 */
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { csvEscape, loadEnv } from './ageRangeUtils';
import { stripHtml, validateDescriptionHtml } from './descriptionUtils';

loadEnv();

const BATCH_SIZE = 5;
const MODEL = process.env.DESC_MODEL || 'claude-sonnet-5-5';

const TOOL: Anthropic.Tool = {
  name: 'record_descriptions',
  description: 'Record the improved description for each book.',
  input_schema: {
    type: 'object',
    properties: {
      books: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The book id exactly as given.' },
            descriptionHtml: {
              type: 'string',
              description: 'Improved description as HTML using only <p>, <ul>, <li>, <strong>, <em>.',
            },
            changeLevel: { type: 'string', enum: ['unchanged', 'minor', 'major'] },
            outsideKnowledge: {
              type: 'boolean',
              description: 'True if ANY fact in the new text is not stated in the provided data (title, author, categories, format, age range, current description).',
            },
            notes: { type: 'string', description: 'One short sentence: what changed, and what was added from outside knowledge (if any).' },
          },
          required: ['id', 'descriptionHtml', 'changeLevel', 'outsideKnowledge', 'notes'],
        },
      },
    },
    required: ['books'],
  },
};

const SYSTEM = `You edit product descriptions for Baytul Iqra, an online Islamic bookstore. The descriptions are shown to shoppers on the website and are also read by a shopping chatbot that matches customers to books by topic and reader age.

Write each description as HTML using only <p>, <ul>, <li>, <strong> and <em> (no attributes, no other tags).

STRUCTURE
1. FIRST <p> = a plain, factual lead of at most 280 characters stating: what kind of book it is, its main topic(s), and who it is for (include the reader age range when one is given, and the format if useful). Use the everyday words a customer would search for (for example "seerah", "dua", "fiqh", "children's stories", "Ramadan", "tafsir", "hadith").
2. Following <p> blocks = the fuller description: keep every concrete fact from the current description (counts, awards, features, what is covered, who wrote or compiled it, endorsements). Do not repeat the lead.

STYLE
- Clear, warm and neutral. Remove filler and hype ("perfect", "must-read", "beautiful", "wonderful") unless it carries real information. Fix typos and awkward grammar. Make it easy to scan.
- Keep honorifics, Arabic terms and transliteration exactly as the current text uses them (for example ﷺ, "may Allah have mercy upon him", Qur'an, Sunnah).
- Length: normally 400 to 1000 characters in total. A very detailed current description may stay longer; a very short one may stay short.
- If the current description is already clear and informative, change as little as possible, only adding or tightening the lead, and set changeLevel to "minor" or "unchanged".

ACCURACY (most important)
- Never invent facts. Do not add page counts, publication dates, awards, endorsements, chapter lists, translators or scholar credentials, or ages that are not in the data.
- You may add a fact from your own knowledge ONLY if you are certain it is true of this exact book. If you do, set outsideKnowledge to true and say what you added in notes. If you are not certain, leave it out.
- If the data is too thin to say anything useful beyond a short lead (for example a one-line description), write a short accurate description from what is given, do not pad, and say so in notes.
- Do not add religious rulings, opinions or claims that the current text does not make.`;

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'description-suggestions.csv';
  const limIdx = args.indexOf('--limit');
  const limit = limIdx >= 0 ? Number(args[limIdx + 1]) : undefined;

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (add it to .env).');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (add it to .env).');

  const prisma = new PrismaClient();
  const client = new Anthropic();

  try {
    const books = await prisma.book.findMany({
      include: { categories: true },
      orderBy: { title: 'asc' },
      ...(limit && limit > 0 ? { take: limit } : {}),
    });
    console.log(`Found ${books.length} book(s) to review using ${MODEL}.`);
    if (books.length === 0) return;

    const byId = new Map(books.map((b) => [b.id, b]));
    type Row = { id: string; descriptionHtml: string; changeLevel: string; outsideKnowledge: boolean; notes: string };
    const rows: string[][] = [];
    const missed: string[] = [];
    const rejected: string[] = [];

    for (let i = 0; i < books.length; i += BATCH_SIZE) {
      const batch = books.slice(i, i + BATCH_SIZE);
      const payload = batch.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        format: b.format,
        ageRange: b.ageRange,
        categories: b.categories.map((c) => c.name),
        currentDescription: b.description,
      }));

      let result: Row[] = [];
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 6000,
          system: SYSTEM,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: TOOL.name },
          messages: [{ role: 'user', content: `Improve these descriptions:\n${JSON.stringify(payload, null, 2)}` }],
        });
        const block = res.content.find((c) => c.type === 'tool_use');
        if (block && block.type === 'tool_use') result = (block.input as { books?: Row[] }).books ?? [];
      } catch (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error instanceof Error ? error.message : error);
      }

      const seen = new Set<string>();
      for (const r of result) {
        const book = byId.get(r.id);
        if (!book || seen.has(r.id)) continue;
        const problem = validateDescriptionHtml(r.descriptionHtml ?? '');
        if (problem) {
          rejected.push(`${book.title}: ${problem}`);
          continue;
        }
        seen.add(r.id);
        rows.push([
          book.id,
          book.title,
          book.author,
          r.changeLevel,
          r.outsideKnowledge ? 'YES' : '',
          r.notes,
          stripHtml(book.description),
          r.descriptionHtml.trim(),
        ]);
      }
      for (const b of batch) if (!seen.has(b.id)) missed.push(b.title);
      console.log(`Processed ${Math.min(i + BATCH_SIZE, books.length)}/${books.length}`);
    }

    // Put rows that used outside knowledge first so they get the closest review.
    rows.sort((a, b) => Number(b[4] === 'YES') - Number(a[4] === 'YES') || a[1].localeCompare(b[1]));

    const header = ['id', 'title', 'author', 'changeLevel', 'outsideKnowledge', 'notes', 'currentDescription', 'suggestedDescription'];
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
    fs.writeFileSync(outFile, csv);

    const outside = rows.filter((r) => r[4] === 'YES').length;
    console.log(`\nWrote ${rows.length} suggestion(s) to ${outFile}.`);
    console.log(`${outside} row(s) include facts from outside the book data (outsideKnowledge = YES, listed first) — verify these carefully.`);
    if (rejected.length) {
      console.log(`${rejected.length} suggestion(s) rejected for invalid markup:`);
      rejected.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
    }
    if (missed.length) {
      console.log(`${missed.length} book(s) have no suggestion — re-run to retry:`);
      missed.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
    }
    console.log('Edit "suggestedDescription" as needed (delete the cell to skip a book), then run: npm run desc:apply');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
