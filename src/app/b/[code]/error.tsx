"use client";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { reportScanFailure } from "@/lib/reportScanFailure";

/** Shown if the scan page itself crashes: log it for the admin and give the customer a way forward. */
export default function ScanError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : "unknown";

  useEffect(() => {
    reportScanFailure(code, "page-error", error.digest || error.message?.slice(0, 80) || "unknown");
  }, [code, error]);

  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-12 text-center" data-testid="scan-error">
      <Image src="/logo-baytul-iqra.png" alt="Baytul Iqra Bookstore" width={64} height={64} className="w-16 h-16 mx-auto object-contain" priority />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-gray-600">We couldn&apos;t open that book. Please try once more, or browse our books.</p>
      <button onClick={reset} className="mt-6 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
        Try again
      </button>
      <div>
        <Link href="/" className="inline-block mt-4 text-sm text-gray-500 underline">Browse all books</Link>
      </div>
    </main>
  );
}
