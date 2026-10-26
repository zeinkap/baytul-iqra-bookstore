import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unitPrice } from '@/lib/pricing';

const MAX_PER_BOOK = 10;
const MAX_LINES = 30;

/**
 * Fresh prices and stock for the in-shop basket (which lives in the browser): the basket page calls this so
 * the customer sees what they will really be charged. Books that are gone or sold out come back in `removed`.
 */
export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
    const requested = new Map<string, number>();
    for (const raw of items) {
      const id = typeof raw?.id === 'string' ? raw.id : '';
      const quantity = raw?.quantity;
      if (!id || !Number.isInteger(quantity) || quantity < 1) {
        return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
      }
      requested.set(id, (requested.get(id) ?? 0) + quantity);
    }

    const books = await prisma.book.findMany({
      where: { id: { in: [...requested.keys()] } },
      select: { id: true, isbn: true, title: true, author: true, price: true, inShopPrice: true, images: true, stock: true },
    });
    const bookById = new Map(books.map((b) => [b.id, b]));

    const lines: { id: string; code: string; title: string; author: string; price: number; image: string; stock: number; quantity: number }[] = [];
    const removed: string[] = [];
    for (const [id, quantity] of requested) {
      const book = bookById.get(id);
      if (!book || book.stock <= 0) {
        removed.push(id);
        continue;
      }
      lines.push({
        id,
        code: book.isbn ?? book.id,
        title: book.title,
        author: book.author,
        price: unitPrice(book, 'in-shop'),
        image: book.images[0] ?? '',
        stock: book.stock,
        quantity: Math.min(quantity, book.stock, MAX_PER_BOOK),
      });
    }
    return NextResponse.json({ lines, removed });
  } catch (error) {
    console.error('Failed to quote in-shop basket:', error);
    return NextResponse.json({ error: 'Failed to load the basket' }, { status: 500 });
  }
}
