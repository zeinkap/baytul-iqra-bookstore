/**
 * Researches current market prices for your books on the web (Claude with web search) and writes a CSV of
 * suggested online and in-person prices for review. Does NOT modify the database.
 * After reviewing/editing the CSV, run applyPrices.ts.
 *
 * Usage:
 *   npx tsx scripts/suggestPrices.ts                       # every book
 *   npx tsx scripts/suggestPrices.ts --limit 5             # try a small sample first
 *   npx tsx scripts/suggestPrices.ts --in-stock            # only books you currently have in stock
 *   npx tsx scripts/suggestPrices.ts --out my.csv          # default: price-suggestions-<today>.csv
 *   npx tsx scripts/suggestPrices.ts --min-margin 0.2      # lowest profit share of the price (default 0.15)
 *   npx tsx scripts/suggestPrices.ts --in-person-discount 0.15   # in-person is this much cheaper (default 0.10)
 *   npx tsx scripts/suggestPrices.ts --concurrency 2       # books researched at the same time (default 3)
 *   npx tsx scripts/suggestPrices.ts --exclude-domain foo.com   # also ignore this site (repeatable)
 *
 * Suppliers you buy from (Kube Publishing, Learning Roots, Imam Ghazali Publishing) are never searched or used as a price source: their
 * prices are your cost, not the market. Edit SUPPLIER_DOMAINS below if that list changes.
 *
 * Every row starts with runDate (the day this script was run). In-person prices are whole dollars, rounded down.
 * Searches cost money (one web-search session per book): try --limit first.
 */
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { loadEnv } from './ageRangeUtils';
import { DEFAULT_RULES, csvEscape, suggestPrices, today, type PriceRules } from './priceUtils';

loadEnv();

const MODEL = process.env.PRICE_MODEL || 'claude-sonnet-5-5';
const MAX_SEARCHES_PER_BOOK = 5;
const MAX_TURNS = 6;

/** Where the shop buys its books: wholesale prices there say nothing about what customers pay. */
const SUPPLIER_DOMAINS = ['kubepublishing.com', 'learningroots.com', 'imamghazali.co'];

const isExcluded = (url: string, domains: string[]) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
};

const webSearchTool = (blockedDomains: string[]): Anthropic.WebSearchTool20250305 => ({
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: MAX_SEARCHES_PER_BOOK,
  blocked_domains: blockedDomains,
});

const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_price',
  description: 'Record what you found for this book. Call it exactly once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      marketPrice: {
        type: ['number', 'null'],
        description: 'Typical current price in USD for a NEW copy of this exact edition and format at reputable retailers, excluding shipping. Null if you could not find a reliable price.',
      },
      competitors: {
        type: 'array',
        description: 'The prices behind marketPrice (up to 5), each from a page you found in the search results.',
        items: {
          type: 'object',
          properties: {
            seller: { type: 'string', description: 'Store or publisher name.' },
            price: { type: 'number', description: 'USD, excluding shipping.' },
            url: { type: 'string', description: 'The exact page URL from the search results.' },
          },
          required: ['seller', 'price', 'url'],
        },
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'high = 2+ reputable sellers agree on the same edition; medium = one good source or small disagreement; low = unsure it is the same edition, or prices vary widely.',
      },
      notes: { type: 'string', description: 'One or two short sentences: edition or format caveats, price spread, anything the shop owner should check.' },
    },
    required: ['marketPrice', 'competitors', 'confidence', 'notes'],
  },
};

const SYSTEM = `You research retail prices for Baytul Iqra, a small Islamic bookstore in the United States that sells at community venues and online.

For the book you are given, use web search to find what customers currently pay for a NEW copy of the same edition and format (paperback, hardcover, ...). Search by ISBN first when one is given, then by title and author.

RULES
- Match the exact edition and format. A different translation, publisher, binding or box set is NOT a match: skip it or lower your confidence.
- Prices in US dollars for new copies only. Ignore used, rental, Kindle/ebook, "from" prices, auction listings and anonymous third-party marketplace sellers. Do not include shipping, tax or member-only prices.
- Never use Kube Publishing, Learning Roots or Imam Ghazali Publishing (kubepublishing.com, learningroots.com, imamghazali.co) as a price source: they are the shop's suppliers, so their prices are not the market. Other publishers' own sites are fine.
- Prefer the publisher, major retailers (Amazon, Barnes & Noble, Books-A-Million) and established Islamic bookstores. If a retailer's price is struck through, use the current price, not the list price.
- marketPrice is the typical price across the good sources you found (the middle value when they differ), not the lowest outlier.
- Only record competitor URLs that appeared in your search results. Never guess a price or a URL; if you cannot find a reliable price, set marketPrice to null and explain in notes.
- Do not set the shop's price yourself; just report the market. Do not reply in plain text: finish by calling record_price once.`;

interface BookRow {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  format: string | null;
  price: number;
  inShopPrice: number | null;
  costPrice: number | null;
  shippingCost: number | null;
}

type Found = {
  marketPrice: number | null;
  competitors: { seller: string; price: number; url: string }[];
  confidence: 'high' | 'medium' | 'low';
  notes: string;
};

/** Runs one book's research: Claude searches (server-side), then calls record_price. */
async function research(client: Anthropic, book: BookRow, blocked: string[]): Promise<{ found: Found; searches: number; seenUrls: Set<string> } | null> {
  const seenUrls = new Set<string>();
  let searches = 0;
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Find the current market price for this book, then call record_price:\n${JSON.stringify(
        { title: book.title, author: book.author, isbn: book.isbn, format: book.format, ourOnlinePrice: book.price },
        null,
        2
      )}`,
    },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [webSearchTool(blocked), RECORD_TOOL],
      messages,
    });

    for (const block of res.content) {
      if (block.type === 'server_tool_use') searches += 1;
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) seenUrls.add(r.url);
      }
      if (block.type === 'tool_use' && block.name === RECORD_TOOL.name) {
        return { found: block.input as Found, searches, seenUrls };
      }
    }

    messages.push({ role: 'assistant', content: res.content });
    // pause_turn: the search was still running; send the conversation back to let it continue.
    if (res.stop_reason !== 'pause_turn') {
      messages.push({ role: 'user', content: `Now call ${RECORD_TOOL.name} with what you found (marketPrice null if nothing reliable).` });
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const runDate = today();
  const outFile = arg('--out') ?? `price-suggestions-${runDate}.csv`;
  const limit = arg('--limit') ? Number(arg('--limit')) : undefined;
  const concurrency = Math.max(1, Number(arg('--concurrency') ?? 3));
  const blocked = [...SUPPLIER_DOMAINS, ...args.flatMap((a, i) => (a === '--exclude-domain' && args[i + 1] ? [args[i + 1].toLowerCase()] : []))];
  const rules: PriceRules = {
    minMargin: arg('--min-margin') ? Number(arg('--min-margin')) : DEFAULT_RULES.minMargin,
    inPersonDiscount: arg('--in-person-discount') ? Number(arg('--in-person-discount')) : DEFAULT_RULES.inPersonDiscount,
  };
  if (!(rules.minMargin >= 0 && rules.minMargin < 1) || !(rules.inPersonDiscount >= 0 && rules.inPersonDiscount < 1)) {
    throw new Error('--min-margin and --in-person-discount must be between 0 and 1 (for example 0.15).');
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (add it to .env).');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (add it to .env).');

  const prisma = new PrismaClient();
  const client = new Anthropic();

  try {
    const books: BookRow[] = await prisma.book.findMany({
      where: args.includes('--in-stock') ? { stock: { gt: 0 } } : undefined,
      select: { id: true, isbn: true, title: true, author: true, format: true, price: true, inShopPrice: true, costPrice: true, shippingCost: true },
      orderBy: { title: 'asc' },
      ...(limit && limit > 0 ? { take: limit } : {}),
    });
    console.log(`Researching ${books.length} book(s) with ${MODEL} (${runDate}). Ignoring: ${blocked.join(', ')}. This can take a while.`);
    if (books.length === 0) return;

    const rows: string[][] = [];
    const failed: string[] = [];
    let totalSearches = 0;
    let done = 0;
    let next = 0;

    async function worker() {
      while (next < books.length) {
        const book = books[next++];
        let result: Awaited<ReturnType<typeof research>> = null;
        try {
          result = await research(client, book, blocked);
        } catch (error) {
          console.error(`  ${book.title}: ${error instanceof Error ? error.message : error}`);
        }
        done += 1;
        console.log(`[${done}/${books.length}] ${book.title}`);
        if (!result) {
          failed.push(book.title);
          continue;
        }
        totalSearches += result.searches;
        rows.push(toRow(book, result.found, result.seenUrls, rules, runDate, blocked));
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, books.length) }, worker));

    rows.sort((a, b) => a[3].localeCompare(b[3]));
    const header = [
      'runDate', 'id', 'isbn', 'title', 'author', 'format',
      'currentOnlinePrice', 'currentInPersonPrice', 'costPrice', 'shippingCost',
      'marketPrice', 'suggestedOnlinePrice', 'suggestedInPersonPrice', 'confidence', 'competitors', 'sources', 'notes',
    ];
    fs.writeFileSync(outFile, [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n') + '\n');

    const withSuggestion = rows.filter((r) => r[11] !== '').length;
    console.log(`\nWrote ${rows.length} row(s) to ${outFile} (${withSuggestion} with a suggested price, ${totalSearches} web searches).`);
    console.log(`Rules: at least ${Math.round(rules.minMargin * 100)}% margin; in-person ${Math.round(rules.inPersonDiscount * 100)}% cheaper, whole dollars.`);
    if (failed.length) {
      console.log(`${failed.length} book(s) could not be researched — re-run to retry:`);
      failed.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
    }
    console.log(`Edit the "suggested…" columns as needed (clear a cell to skip it), then run: npx tsx scripts/applyPrices.ts ${outFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

function toRow(book: BookRow, found: Found, seenUrls: Set<string>, rules: PriceRules, runDate: string, blocked: string[]): string[] {
  // Only keep competitor prices whose page really came up in the search results
  const verified = (found.competitors ?? []).filter((c) => c && typeof c.price === 'number' && c.price > 0 && seenUrls.has(c.url) && !isExcluded(c.url, blocked));
  const notes: string[] = [];
  if (found.notes) notes.push(found.notes.trim());

  let market = typeof found.marketPrice === 'number' && found.marketPrice > 0 ? found.marketPrice : null;
  let confidence: string = found.confidence;
  if (market != null && verified.length === 0) {
    notes.push('no price source could be verified in the search results; treat as a guess');
    confidence = 'low';
  }
  if (market != null && book.costPrice == null) notes.push('no cost price on file, so the margin check was skipped');

  let suggestedOnline = '';
  let suggestedInPerson = '';
  if (market != null) {
    const s = suggestPrices(market, book, rules);
    suggestedOnline = s.online.toFixed(2);
    suggestedInPerson = String(s.inPerson);
    notes.push(...s.notes);
  } else {
    market = null;
  }

  return [
    runDate,
    book.id,
    book.isbn ?? '',
    book.title,
    book.author,
    book.format ?? '',
    book.price.toFixed(2),
    book.inShopPrice != null ? book.inShopPrice.toFixed(2) : '',
    book.costPrice != null ? book.costPrice.toFixed(2) : '',
    book.shippingCost != null ? book.shippingCost.toFixed(2) : '',
    market != null ? market.toFixed(2) : '',
    suggestedOnline,
    suggestedInPerson,
    confidence,
    verified.map((c) => `${c.seller} $${c.price.toFixed(2)}`).join(' | '),
    verified.map((c) => c.url).join(' | '),
    notes.join('; '),
  ];
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
