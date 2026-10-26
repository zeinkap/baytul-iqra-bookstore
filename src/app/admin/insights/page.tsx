"use client";
import { useEffect, useState } from "react";

type Bucket = { orders: number; revenue: number };
interface Insights {
  range: { days: number; source: string; venue: string | null };
  time: {
    byHour: ({ hour: number } & Bucket)[];
    byWeekday: ({ day: string } & Bucket)[];
    byDay: ({ date: string } & Bucket)[];
    busiestHour: ({ hour: number } & Bucket) | null;
    busiestWeekday: ({ day: string } & Bucket) | null;
  };
  profit: {
    revenue: number; cost: number; grossProfit: number; estimatedStripeFees: number; profitAfterFees: number;
    avgProfitPerOrder: number; marginPercent: number; booksMissingCost: number;
    perBook: { bookId: string; title: string; units: number; revenue: number; profit: number; profitPerCopy: number | null }[];
  };
  events: {
    rows: EventRow[];
    totalFees: number;
    profitAfterEventFees: number;
  };
  baskets: {
    orders: number; avgItemsPerOrder: number; avgOrderValue: number;
    distribution: { one: number; two: number; threePlus: number };
    buyers: number; repeatBuyers: number; repeatRatePercent: number; ordersWithoutEmail: number;
  };
  restock: {
    windowDays: number;
    restock: StockRow[];
    slowMovers: StockRow[];
    top: StockRow[];
  };
  payments: {
    methods: { method: string; orders: number; revenue: number; sharePercent: number }[];
    devices: { device: string; scans: number; orders: number; conversionPercent: number | null }[];
  };
}
interface EventRow {
  venue: string; orders: number; books: number; revenue: number; profitBeforeFee: number; fee: number | null;
  net: number; covered: boolean | null; stillToCover: number | null; breakEvenBooks: number | null;
}
interface StockRow {
  bookId: string; title: string; stock: number; sold: number; perWeek: number; weeksLeft: number | null;
  sellThroughPercent: number; costOfStock: number | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;
const methodLabel: Record<string, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay", card: "Card", link: "Link", unknown: "Not recorded" };
const deviceLabel: Record<string, string> = { ios: "iPhone / iPad", android: "Android", desktop: "Computer", other: "Other", unknown: "Not recorded" };

export default function AdminInsightsPage() {
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<"in-shop" | "all">("in-shop");
  const [venue, setVenue] = useState("");
  const [venues, setVenues] = useState<string[]>([]);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [feeVenue, setFeeVenue] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeError, setFeeError] = useState<string | null>(null);

  async function saveFee(venueName: string, amount: string) {
    setFeeError(null);
    const res = await fetch("/api/admin/venue-fees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venue: venueName, fee: amount.trim() === "" ? null : Number(amount) }),
    });
    if (!res.ok) {
      setFeeError((await res.json().catch(() => null))?.error ?? "Could not save the fee");
      return;
    }
    setFeeAmount("");
    setReload((n) => n + 1);
  }

  useEffect(() => {
    fetch("/api/admin/venue").then((r) => (r.ok ? r.json() : null)).then((d) => d && setVenues(d.known)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ days: String(days), source });
    if (venue) params.set("loc", venue);
    fetch(`/api/admin/insights?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load insights"))))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days, source, venue, reload]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <a href="/api/cron/daily-summary?preview=1" target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline" data-testid="summary-preview-link">
            Preview the daily summary email
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={source} onChange={(v) => setSource(v as "in-shop" | "all")} testId="insights-source">
            <option value="in-shop">In-shop sales</option>
            <option value="all">All sales (incl. online)</option>
          </Select>
          <Select value={venue} onChange={setVenue} testId="insights-venue">
            <option value="">All venues</option>
            {venues.map((v) => <option key={v} value={v}>{v}</option>)}
            <option value="none">(no venue tag)</option>
          </Select>
          <Select value={String(days)} onChange={(v) => setDays(Number(v))} testId="insights-days">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!data && !error && <p className="text-gray-600">Loading…</p>}

      {data && (
        <div className="space-y-8">
          <Section title="Sales by time" note="Times are Eastern. Bars show revenue; hover for order counts.">
            {data.baskets.orders === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Stat label="Busiest hour" value={data.time.busiestHour ? `${hourLabel(data.time.busiestHour.hour)} (${money(data.time.busiestHour.revenue)})` : "n/a"} />
                  <Stat label="Best weekday" value={data.time.busiestWeekday ? `${data.time.busiestWeekday.day} (${money(data.time.busiestWeekday.revenue)})` : "n/a"} />
                </div>
                <h3 className="text-sm font-semibold mb-1">By hour of day</h3>
                <Bars items={data.time.byHour.map((h) => ({ label: hourLabel(h.hour), value: h.revenue, title: `${hourLabel(h.hour)}: ${h.orders} orders, ${money(h.revenue)}` }))} />
                <h3 className="text-sm font-semibold mt-4 mb-1">By weekday</h3>
                <Bars items={data.time.byWeekday.map((d) => ({ label: d.day, value: d.revenue, title: `${d.day}: ${d.orders} orders, ${money(d.revenue)}` }))} />
                <h3 className="text-sm font-semibold mt-4 mb-1">By day</h3>
                <Bars items={data.time.byDay.map((d) => ({ label: d.date.slice(5), value: d.revenue, title: `${d.date}: ${d.orders} orders, ${money(d.revenue)}` }))} thin />
              </>
            )}
          </Section>

          <Section title="Profit per sale" note="Profit = price paid minus your cost price. Stripe fees are an estimate (2.9% + $0.30 per order); your Stripe dashboard has the exact amount.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Stat label="Revenue" value={money(data.profit.revenue)} />
              <Stat label="Profit after est. fees" value={money(data.profit.profitAfterFees)} hint={`${data.profit.marginPercent}% margin`} />
              <Stat label="Avg profit per order" value={money(data.profit.avgProfitPerOrder)} />
              <Stat label="Est. Stripe fees" value={money(data.profit.estimatedStripeFees)} />
            </div>
            {data.events.totalFees > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="Event fees" value={money(data.events.totalFees)} hint="flat fees for the venues below" />
                <Stat label="Profit after event fees" value={money(data.events.profitAfterEventFees)} />
              </div>
            )}
            {data.profit.booksMissingCost > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3" data-testid="missing-cost-note">
                {data.profit.booksMissingCost} sold book(s) have no cost price set, so profit is overstated. Add cost prices in Admin → Books.
              </p>
            )}
            <Table
              head={["Book", "Copies", "Revenue", "Profit", "Per copy"]}
              rows={data.profit.perBook.map((b) => [b.title, b.units, money(b.revenue), money(b.profit), b.profitPerCopy === null ? "no cost" : money(b.profitPerCopy)])}
              empty="No sales in this period."
            />
          </Section>

          <Section title="Events and venues" note="Profit per venue after the flat fee you pay to sell there (for example a $50 bazaar stall). Use one venue name per event, like bazaar-oct, so each event has its own fee. Profit is after estimated Stripe fees.">
            <Table
              testId="events-table"
              head={["Venue", "Orders", "Books", "Revenue", "Profit", "Fee", "After fee", "Books to break even"]}
              rows={data.events.rows.map((r) => [
                r.venue,
                r.orders,
                r.books,
                money(r.revenue),
                money(r.profitBeforeFee),
                r.fee === null ? "no fee" : money(r.fee),
                r.fee === null ? "-" : r.covered ? `+${money(r.net)} covered` : `${money(r.net)} (${money(r.stillToCover ?? 0)} to go)`,
                r.breakEvenBooks === null ? "-" : `${r.breakEvenBooks} (sold ${r.books})`,
              ])}
              empty="No sales at a tagged venue in this period."
            />
            <form
              className="flex flex-wrap items-end gap-2 mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (feeVenue) saveFee(feeVenue, feeAmount);
              }}
            >
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">Set the fee for a venue</span>
                <select value={feeVenue} onChange={(e) => setFeeVenue(e.target.value)} className="border border-gray-300 rounded px-3 py-2 bg-white text-gray-900" data-testid="fee-venue">
                  <option value="">Choose a venue</option>
                  {venues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">Flat fee ($)</span>
                <input
                  type="number" min={0} step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="50"
                  className="border border-gray-300 rounded px-3 py-2 w-28 bg-white text-gray-900" data-testid="fee-amount"
                />
              </label>
              <button type="submit" disabled={!feeVenue} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" data-testid="fee-save">Save fee</button>
              <span className="text-xs text-gray-500">Leave the amount empty and save to remove a fee.</span>
            </form>
            {feeError && <p className="text-sm text-red-600 mt-2">{feeError}</p>}
          </Section>

          <Section title="Basket size and repeat buyers" note="Buy now is one book per purchase, so repeat buyers (same email, more than one purchase) tell you more than basket size.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Orders" value={String(data.baskets.orders)} />
              <Stat label="Avg order value" value={money(data.baskets.avgOrderValue)} />
              <Stat label="Avg books per order" value={String(data.baskets.avgItemsPerOrder)} hint={`1: ${data.baskets.distribution.one} · 2: ${data.baskets.distribution.two} · 3+: ${data.baskets.distribution.threePlus}`} />
              <Stat label="Repeat buyers" value={`${data.baskets.repeatBuyers} of ${data.baskets.buyers}`} hint={`${data.baskets.repeatRatePercent}% have bought more than once`} />
            </div>
            {data.baskets.ordersWithoutEmail > 0 && (
              <p className="text-xs text-gray-500 mt-2">{data.baskets.ordersWithoutEmail} order(s) have no email yet, so they can&apos;t be matched to repeat buyers.</p>
            )}
          </Section>

          <Section title="Sell-through and restock list" note={`Based on every paid sale (all venues, online too) in the last ${data.restock.windowDays} days, since stock is shared.`}>
            <h3 className="text-sm font-semibold mb-1">Restock soon</h3>
            <Table
              head={["Book", "In stock", "Sold", "Per week", "Weeks left"]}
              rows={data.restock.restock.map((r) => [r.title, r.stock, r.sold, r.perWeek, r.weeksLeft === null ? "n/a" : r.stock === 0 ? "sold out" : r.weeksLeft])}
              empty="Nothing needs restocking right now."
              testId="restock-table"
            />
            <h3 className="text-sm font-semibold mt-4 mb-1">Best sellers</h3>
            <Table
              head={["Book", "Sold", "In stock", "Sell-through"]}
              rows={data.restock.top.map((r) => [r.title, r.sold, r.stock, `${r.sellThroughPercent}%`])}
              empty="No sales in this period."
            />
            <h3 className="text-sm font-semibold mt-4 mb-1">Slow movers (in stock, none sold)</h3>
            <Table
              head={["Book", "In stock", "Cost tied up"]}
              rows={data.restock.slowMovers.map((r) => [r.title, r.stock, r.costOfStock === null ? "n/a" : money(r.costOfStock)])}
              empty="Every book in stock has sold at least once."
            />
          </Section>

          <Section title="Payment method and device" note="Payment method is recorded from Stripe for purchases after this feature launched; earlier ones show as not recorded.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Table
                head={["Paid with", "Orders", "Share"]}
                rows={data.payments.methods.map((m) => [methodLabel[m.method] ?? m.method, m.orders, `${m.sharePercent}%`])}
                empty="No sales in this period."
              />
              <Table
                head={["Device", "Scans", "Orders", "Scan to buy"]}
                rows={data.payments.devices.map((d) => [deviceLabel[d.device] ?? d.device, d.scans, d.orders, d.conversionPercent === null ? "n/a" : `${d.conversionPercent}%`])}
                empty="No scans yet."
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, children, testId }: { value: string; onChange: (v: string) => void; children: React.ReactNode; testId: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-300 rounded px-3 py-2 bg-white text-gray-900" data-testid={testId}>
      {children}
    </select>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-xs text-gray-500 mb-3">{note}</p>}
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-gray-500 text-sm">No sales in this period yet.</p>;
}

function Bars({ items, thin }: { items: { label: string; value: number; title: string }[]; thin?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 0.01);
  return (
    <div className="flex items-end gap-px h-28 bg-white rounded-lg border border-gray-100 px-2 pt-2 pb-1 overflow-x-auto">
      {items.map((i, idx) => (
        <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 min-w-[6px]" title={i.title}>
          <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max((i.value / max) * 100, i.value > 0 ? 4 : 0)}%` }} />
          {!thin && <span className="text-[9px] text-gray-500 mt-0.5">{i.label}</span>}
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows, empty, testId }: { head: string[]; rows: (string | number)[][]; empty: string; testId?: string }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto" data-testid={testId}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left bg-gray-50">
            {head.map((h, i) => <th key={h} className={`py-2 px-3 ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="py-4 px-3 text-center text-gray-500">{empty}</td></tr>}
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-gray-100">
              {r.map((cell, ci) => <td key={ci} className={`py-2 px-3 ${ci > 0 ? "text-right" : ""}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
