import Image from 'next/image';
import Link from 'next/link';
import { normalizeLocation } from '@/lib/location';
import { VENUE_STEPS, VENUE_STORE_NAME, boldSegments, prettyVenue } from '@/lib/venueCopy';

/** Landing page after scanning a venue sign: tells first-time customers how self-service buying works. */
export default async function VenueWelcomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const venue = normalizeLocation((await searchParams).v);
  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-12 text-center" data-testid="venue-welcome">
      <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={72} height={72} className="w-18 h-18 mx-auto object-contain" priority />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Welcome{venue ? ` to ${prettyVenue(venue)}` : ''}!</h1>
      <p className="mt-2 text-gray-600">{VENUE_STORE_NAME}</p>
      <ol className="mt-6 text-left space-y-3 text-gray-800">
        {VENUE_STEPS.map((step, i) => (
          <li key={i}>
            <span className="font-semibold">{i + 1}.</span>{' '}
            {boldSegments(step).map((seg, j) => (seg.bold ? <strong key={j}>{seg.text}</strong> : <span key={j}>{seg.text}</span>))}
          </li>
        ))}
      </ol>
      <Link href="/" className="inline-block mt-8 text-sm text-gray-500 underline">Browse our full catalog</Link>
    </main>
  );
}
