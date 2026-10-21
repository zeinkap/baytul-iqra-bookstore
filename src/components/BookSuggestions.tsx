import Link from 'next/link';
import Image from 'next/image';
import type { Suggestion } from '@/lib/suggestions';

/** Grid of suggested books; each links to its QR scan card (/b/<code>) for a quick buy. */
export default function BookSuggestions({ title, suggestions, location }: { title: string; suggestions: Suggestion[]; location?: string }) {
  if (suggestions.length === 0) return null;
  return (
    <section className="text-left" data-testid="scan-suggestions">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <ul className="grid grid-cols-2 gap-3">
        {suggestions.map((s) => (
          <li key={s.id}>
            <Link href={`/b/${s.code}${location ? `?loc=${location}` : ''}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm p-3 h-full">
              {s.image && (
                <div className="relative mx-auto mb-2 w-24 h-32">
                  <Image src={s.image} alt={s.title} fill sizes="96px" className="object-contain" />
                </div>
              )}
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{s.title}</p>
              <p className="text-xs text-gray-500 line-clamp-1">{s.author}</p>
              <p className="text-sm font-bold text-emerald-700 mt-1">${s.price.toFixed(2)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
