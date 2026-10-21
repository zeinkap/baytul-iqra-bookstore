"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

interface Book {
  id: string;
  title: string;
  stock: number;
}
interface Count {
  id: string;
  bookTitle: string;
  systemStock: number;
  countedStock: number;
  difference: number;
  adjusted: boolean;
  location: string | null;
  countedAt: string;
}
interface Summary {
  booksCounted: number;
  missingUnits: number;
  extraUnits: number;
  missingValueAtCost: number;
}

export default function AdminStockCountsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [adjust, setAdjust] = useState(false);
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Count[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadHistory = () =>
    fetch("/api/admin/stock-counts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load history"))))
      .then((d) => {
        setHistory(d.counts);
        setSummary(d.summary);
      })
      .catch((e) => toast.error(e.message));

  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((data: Book[]) => setBooks([...data].sort((a, b) => a.title.localeCompare(b.title))))
      .catch(() => toast.error("Failed to load books"));
    loadHistory();
  }, []);

  const visible = useMemo(
    () => books.filter((b) => b.title.toLowerCase().includes(search.trim().toLowerCase())),
    [books, search]
  );
  const filled = books.filter((b) => entered[b.id] !== undefined && entered[b.id] !== "");
  const differences = filled.filter((b) => Number(entered[b.id]) !== b.stock);

  async function save() {
    if (filled.length === 0) return;
    if (adjust && differences.length > 0 && !confirm(`Update stock for ${differences.length} book(s) to the counted numbers?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counts: filled.map((b) => ({ bookId: b.id, counted: Number(entered[b.id]) })),
          adjust,
          location: location || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save counts");
      toast.success(`Saved ${data.saved} counts (${data.differences} differ${adjust ? ", stock updated" : ""})`);
      setEntered({});
      const refreshed = await fetch("/api/books").then((r) => r.json());
      setBooks([...refreshed].sort((a: Book, b: Book) => a.title.localeCompare(b.title)));
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save counts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-gray-900">
      <h1 className="text-2xl font-bold mb-1">Stock Counts</h1>
      <p className="text-sm text-gray-600 mb-4">
        Count the books on the shelf and enter the numbers. The gap against the system stock shows books that left without
        being paid for (or miscounts). Leave a row blank to skip it.
      </p>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-testid="shrink-summary">
          <Card label="Counts (90 days)" value={String(summary.booksCounted)} />
          <Card label="Missing books" value={String(summary.missingUnits)} />
          <Card label="Missing value (cost)" value={`$${summary.missingValueAtCost.toFixed(2)}`} />
          <Card label="Extra books found" value={String(summary.extraUnits)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title…"
          className="border border-gray-300 rounded px-3 py-2 bg-white"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value.toLowerCase())}
          placeholder="Venue (optional), e.g. cafe-a"
          className="border border-gray-300 rounded px-3 py-2 bg-white"
          data-testid="count-venue"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
          Also update stock to the counted numbers
        </label>
        <button
          onClick={save}
          disabled={saving || filled.length === 0}
          className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2 rounded-lg font-semibold"
          data-testid="save-counts"
        >
          {saving ? "Saving…" : `Save ${filled.length} count${filled.length === 1 ? "" : "s"}`}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-2 px-3">Book</th>
              <th className="py-2 px-3 text-right">System stock</th>
              <th className="py-2 px-3 text-right w-32">Counted</th>
              <th className="py-2 px-3 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const raw = entered[b.id];
              const diff = raw !== undefined && raw !== "" ? Number(raw) - b.stock : null;
              return (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="py-2 px-3">{b.title}</td>
                  <td className="py-2 px-3 text-right">{b.stock}</td>
                  <td className="py-2 px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={raw ?? ""}
                      onChange={(e) => setEntered((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-right bg-white"
                      aria-label={`Counted ${b.title}`}
                    />
                  </td>
                  <td className={`py-2 px-3 text-right font-semibold ${diff === null || diff === 0 ? "text-gray-400" : diff < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {diff === null ? "" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-2">History (last 90 days)</h2>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Book</th>
              <th className="py-2 px-3">Venue</th>
              <th className="py-2 px-3 text-right">System</th>
              <th className="py-2 px-3 text-right">Counted</th>
              <th className="py-2 px-3 text-right">Diff</th>
              <th className="py-2 px-3">Stock updated</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={7} className="py-6 px-3 text-center text-gray-500">No counts yet.</td></tr>
            )}
            {history.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="py-2 px-3 whitespace-nowrap">{new Date(c.countedAt).toLocaleDateString()}</td>
                <td className="py-2 px-3">{c.bookTitle}</td>
                <td className="py-2 px-3">{c.location ?? ""}</td>
                <td className="py-2 px-3 text-right">{c.systemStock}</td>
                <td className="py-2 px-3 text-right">{c.countedStock}</td>
                <td className={`py-2 px-3 text-right font-semibold ${c.difference < 0 ? "text-red-600" : c.difference > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                  {c.difference > 0 ? `+${c.difference}` : c.difference}
                </td>
                <td className="py-2 px-3">{c.adjusted ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
