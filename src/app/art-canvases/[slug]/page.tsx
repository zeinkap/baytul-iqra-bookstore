import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BookDetailClient from '../../books/[id]/BookDetailClient';
import type { Book } from '../../books/[id]/page';
import { getRelatedCatalogBooks } from '@/lib/catalog';
import { getArtPieces } from '@/lib/artPages';

async function findPiece(slug: string) {
  return (await getArtPieces()).find((p) => p.slug === slug)?.piece ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const piece = await findPiece((await params).slug);
  return piece ? { title: `${piece.title} | Baytul Iqra`, description: piece.description.slice(0, 160) } : {};
}

/** A painting's page. Same page as a book's, at a readable address: /art-canvases/as-salaam */
export default async function ArtPiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const piece: Book | null = await findPiece((await params).slug);
  if (!piece) return notFound();
  const related: Book[] = await getRelatedCatalogBooks(piece.categories, piece.id);
  return <BookDetailClient book={piece} relatedBooks={related} />;
}
