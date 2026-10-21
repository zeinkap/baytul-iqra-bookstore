"use client";
import { useEffect, useState } from "react";

interface Row {
  bookId: string;
  title: string;
  stock: number;
  scans: number;
  purchases: number;
  abandoned: number;
  revenue: number;
  conversion: number | null;
}
interface Venue {
  location: string;
  scans: number;
  paidOrders: number;
  revenue: number;
  abandoned: number;
}
interface Stats {
  days: number;
  location: string | null;
  totals: { scans: number; soldOutScans: number; notFoundScans: number; paidOrders: number; purchases: number; revenue: number; abandoned: number };
  venues: Venue[];
  rows: Row[];
}

const NO_VENUE = "(no venue tag)";
const money = (n: number) => `$${n.toFixed(2)}`;

export default function AdminScansPage() {
  const [days, setDays] = useState(30);
  const [venue, setVenue] = useState(""); // "" = all venues, "none" = untagged, otherwise a slug
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ days: String(days) });
    if (venue) params.set("loc", venue);
    fetch(`/api/admin/scan-stats?${params}`)
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
  }, [days, venue]);

  const venueValue = (name: string) => (name === NO_VENUE ? "none" : name);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">QR Scans</h1>
        <div className="flex gap-2">
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
            data-testid="scan-venue"
          >
            <option value="">All venues</option>
            {stats?.venues.map((v) => (
              <option key={v.location} value={venueValue(v.location)}>{v.location}</option>
            ))}
          </select>
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
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {!stats && !error && <p className="text-gray-600">Loading…</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Stat label="Scans" value={String(stats.totals.scans)} />
            <Stat label="Paid orders" value={String(stats.totals.paidOrders)} hint={`${stats.totals.purchases} copies`} />
            <Stat label="Revenue" value={money(stats.totals.revenue)} />
            <Stat label="Abandoned checkouts" value={String(stats.totals.abandoned)} hint="Tapped Buy now, never paid (30+ min ago)" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Stat label="Sold-out scans" value={String(stats.totals.soldOutScans)} hint="Lost sales: restock these" />
            <Stat label="Unknown codes" value={String(stats.totals.notFoundScans)} hint="Label points to a missing book" />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">By venue</h2>
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto mb-6">
            <table className="w-full text-sm text-gray-900" data-testid="venue-table">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="py-2 px-3">Venue</th>
                  <th className="py-2 px-3 text-right">Scans</th>
                  <th className="py-2 px-3 text-right">Paid orders</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                  <th className="py-2 px-3 text-right">Abandoned</th>
                </tr>
              </thead>
              <tbody>
                {stats.venues.length === 0 && (
                  <tr><td colSpan={5} className="py-4 px-3 text-center text-gray-500">No activity yet in this period.</td></tr>
                )}
                {stats.venues.map((v) => (
                  <tr key={v.location} className="border-t border-gray-100">
                    <td className="py-2 px-3">{v.location}</td>
                    <td className="py-2 px-3 text-right">{v.scans}</td>
                    <td className="py-2 px-3 text-right">{v.paidOrders}</td>
                    <td className="py-2 px-3 text-right">{money(v.revenue)}</td>
                    <td className="py-2 px-3 text-right">{v.abandoned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">By book{venue ? " (filtered venue)" : ""}</h2>
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="py-2 px-3">Book</th>
                  <th className="py-2 px-3 text-right">Scans</th>
                  <th className="py-2 px-3 text-right">Bought</th>
                  <th className="py-2 px-3 text-right">Abandoned</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                  <th className="py-2 px-3 text-right">Conversion</th>
                  <th className="py-2 px-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.length === 0 && (
                  <tr><td colSpan={7} className="py-6 px-3 text-center text-gray-500">No scans yet in this period.</td></tr>
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
                      <td className="py-2 px-3 text-right">{r.abandoned}</td>
                      <td className="py-2 px-3 text-right">{money(r.revenue)}</td>
                      <td className="py-2 px-3 text-right">{r.conversion === null ? "n/a" : `${Math.round(r.conversion * 100)}%`}</td>
                      <td className="py-2 px-3 text-right">{r.stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Scans are counted once per phone session. Paid orders and revenue count paid in-shop purchases (Buy now). Venues come from
            the <code>?loc=</code> tag in the QR link; labels made without one show as {NO_VENUE}. Abandoned means the buyer tapped Buy now
            but never paid within 30 minutes.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4" title={hint}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}
