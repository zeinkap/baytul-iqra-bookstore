"use client";
import { useEffect, useState } from "react";

interface Row {
  bookId: string;
  title: string;
  isbn: string | null;
  stock: number;
  scans: number;
  purchases: number;
  conversion: number | null;
}
interface Stats {
  days: number;
  totals: { scans: number; soldOutScans: number; notFoundScans: number; purchases: number };
  rows: Row[];
}

export default function AdminScansPage() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/scan-stats?days=${days}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load scan stats"))))
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">QR Scans</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
          data-testid="scan-days"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {!stats && !error && <p className="text-gray-600">Loading…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Scans" value={stats.totals.scans} />
            <Stat label="Paid in-shop copies" value={stats.totals.purchases} />
            <Stat label="Sold-out scans" value={stats.totals.soldOutScans} hint="Lost sales: restock these" />
            <Stat label="Unknown codes" value={stats.totals.notFoundScans} hint="Label points to a missing book" />
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="py-2 px-3">Book</th>
                  <th className="py-2 px-3 text-right">Scans</th>
                  <th className="py-2 px-3 text-right">Bought</th>
                  <th className="py-2 px-3 text-right">Conversion</th>
                  <th className="py-2 px-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 px-3 text-center text-gray-500">No scans yet in this period.</td>
                  </tr>
                )}
                {stats.rows.map((r) => {
                  // Scanned several times but never bought: the label or the page isn't converting
                  const weak = r.scans >= 3 && r.purchases === 0;
                  return (
                    <tr key={r.bookId} className={`border-t border-gray-100 ${weak ? "bg-amber-50" : ""}`}>
                      <td className="py-2 px-3">
                        {r.title}
                        {weak && <span className="ml-2 text-xs font-medium text-amber-800">no purchases</span>}
                      </td>
                      <td className="py-2 px-3 text-right">{r.scans}</td>
                      <td className="py-2 px-3 text-right">{r.purchases}</td>
                      <td className="py-2 px-3 text-right">
                        {r.conversion === null ? "n/a" : `${Math.round(r.conversion * 100)}%`}
                      </td>
                      <td className="py-2 px-3 text-right">{r.stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Scans are counted once per phone session. Purchases count paid in-shop orders (Buy now and scan-cart), so
            conversion can pass 100% if a customer buys without a counted scan.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4" title={hint}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
