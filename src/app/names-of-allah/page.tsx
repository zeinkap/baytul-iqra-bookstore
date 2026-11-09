import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCatalogBooks } from '@/lib/catalog';
import { ART_CATEGORY, isArtPiece } from '@/lib/artCollection';

export const metadata: Metadata = {
  title: `${ART_CATEGORY} | Baytul Iqra`,
  description: "Handmade acrylic paintings on wood, the Names of Allah set against scenes of nature. Every piece is one-of-a-kind.",
};

/** The art series: each painting is a catalog item in the ART_CATEGORY category (see src/lib/artCollection.ts). */
export default async function NamesOfAllahPage() {
  const pieces = (await getCatalogBooks()).filter((b) => isArtPiece(b.categories));
  // Available pieces first, then sold ones (kept visible so visitors see the whole series)
  const sorted = [...pieces].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="max-w-2xl mx-auto text-center mb-8 sm:mb-12">
          <p className="text-sm font-semibold text-emerald-700 mb-2">Handmade art collection</p>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4" data-testid="art-collection-title">{ART_CATEGORY}</h1>
          <p className="text-gray-600 sm:text-lg leading-relaxed">
            Hand-painted acrylic on wood: the Names of Allah set against scenes of nature. Every piece is original and
            one-of-a-kind, so when it&apos;s gone, it&apos;s gone.
          </p>
        </header>

        {sorted.length === 0 ? (
          <p className="text-center text-gray-600" data-testid="art-collection-empty">The first paintings are coming soon, insha&apos;Allah.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6" data-testid="art-collection-grid">
            {sorted.map((piece) => {
              const sold = piece.stock <= 0;
              const image = piece.images[0];
              return (
                <li key={piece.id}>
                  <Link
                    href={`/books/${piece.id}`}
                    data-testid="art-piece"
                    className="block bg-white rounded-2xl shadow border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="relative aspect-square bg-gray-50">
                      {image && (
                        <Image
                          src={image}
                          alt={piece.title}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className={`object-cover ${sold ? 'opacity-60' : ''}`}
                        />
                      )}
                      {sold && (
                        <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-gray-900/80 text-white text-xs font-semibold" data-testid="art-sold-badge">
                          Sold
                        </span>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <h2 className="font-semibold text-gray-900 line-clamp-2">{piece.title}</h2>
                      {piece.format && <p className="text-xs text-gray-500 mt-0.5">{piece.format}</p>}
                      <p className="mt-2 font-bold text-emerald-700">{sold ? 'Sold' : `$${piece.price.toFixed(2)}`}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-center mt-10">
          <Link href="/" className="text-sm text-gray-500 underline">Browse our books</Link>
        </p>
      </div>
    </main>
  );
}
