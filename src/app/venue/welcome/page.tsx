import Image from 'next/image';
import Link from 'next/link';
import { normalizeLocation } from '@/lib/location';

const pretty = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Landing page after scanning a venue sign: tells first-time customers how self-service buying works. */
export default async function VenueWelcomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const venue = normalizeLocation((await searchParams).v);
  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-12 text-center" data-testid="venue-welcome">
      <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={72} height={72} className="w-18 h-18 mx-auto object-contain" priority />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Welcome{venue ? ` to ${pretty(venue)}` : ''}!</h1>
      <p className="mt-2 text-gray-600">Baytul Iqra Bookstore</p>
      <ol className="mt-6 text-left space-y-3 text-gray-800">
        <li><span className="font-semibold">1.</span> Pick a book and find the QR sticker on the back cover.</li>
        <li><span className="font-semibold">2.</span> Scan it with your phone camera.</li>
        <li><span className="font-semibold">3.</span> Tap <strong>Buy now</strong> and pay with Apple Pay, Google Pay or card.</li>
        <li><span className="font-semibold">4.</span> Enjoy your book! A receipt is emailed to you.</li>
      </ol>
      <Link href="/" className="inline-block mt-8 text-sm text-gray-500 underline">Browse our full catalog</Link>
    </main>
  );
}
