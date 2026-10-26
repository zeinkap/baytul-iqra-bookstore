"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  price: number;
  inShopPrice?: number | null;
  stock: number;
}
interface Sale {
  id: string;
  items: { title: string; quantity: number }[];
  finalTotal: number;
  paymentMethod: string | null;
  location: string | null;
  paidAt: string | null;
  refundedAt: string | null;
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
] as const;

const money = (n: number) => `$${n.toFixed(2)}`;
/** Same rule the server uses for in-person sales */
const inPersonPrice = (b: Book) => (b.inShopPrice != null && b.inShopPrice >= 0 ? Math.min(b.inShopPrice, b.price) : b.price);

export default function RecordSalePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [venue, setVenue] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadBooks() {
    const res = await fetch("/api/books?bypassCache=1");
    if (res.ok) setBooks(await res.json());
  }
  async function loadSales() {
    const res = await fetch("/api/admin/manual-sales");
    if (res.ok) setSales((await res.json()).sales);
  }

  useEffect(() => {
    loadBooks();
    loadSales();
    fetch("/api/admin/venue").then((r) => (r.ok ? r.json() : null)).then((d) => d?.current && setVenue((v) => v || d.current)).catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return books
      .filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.isbn ?? "").includes(q.replace(/-/g, "")))
      .slice(0, 8);
  }, [books, search]);

  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({ book: books.find((b) => b.id === id), quantity }))
    .filter((l): l is { book: Book; quantity: number } => !!l.book);
  const total = lines.reduce((sum, l) => sum + inPersonPrice(l.book) * l.quantity, 0);

  function change(book: Book, delta: number) {
    setCart((c) => {
      const next = Math.max(0, Math.min((c[book.id] ?? 0) + delta, Math.max(book.stock, 0)));
      const { [book.id]: _removed, ...rest } = c; // eslint-disable-line @typescript-eslint/no-unused-vars
      return next > 0 ? { ...rest, [book.id]: next } : rest;
    });
  }

  async function record() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/manual-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ id: l.book.id, quantity: l.quantity })), method, venue: venue.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not record the sale");
      toast.success(`Recorded ${money(data.total)} (${method})`);
      setCart({});
      setSearch("");
      await Promise.all([loadBooks(), loadSales()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the sale");
    } finally {
      setSaving(false);
    }
  }

  async function undo(sale: Sale) {
    if (!confirm(`Undo this ${money(sale.finalTotal)} sale and put the books back in stock?`)) return;
    const res = await fetch(`/api/admin/manual-sales/${sale.id}/void`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Could not undo the sale");
      return;
    }
    toast.success("Sale undone, books back in stock");
    await Promise.all([loadBooks(), loadSales()]);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 text-gray-900">
      <h1 className="text-2xl font-bold mb-1">Record a sale</h1>
      <p className="text-sm text-gray-600 mb-4">For cash, Zelle and other sales that don&apos;t go through Stripe. Uses the in-person price and takes the books out of stock.</p>

      <label className="block text-xs text-gray-500 mb-1" htmlFor="sale-venue">Venue</label>
      <input
        id="sale-venue" value={venue} onChange={(e) => setVenue(e.target.value.toLowerCase())} placeholder="e.g. bazaar-oct (empty = no venue)"
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 bg-white text-gray-900" data-testid="sale-venue"
      />

      <input
        value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a book by title, author or ISBN"
        className="w-full border border-gray-300 rounded px-3 py-3 bg-white text-gray-900" data-testid="sale-search"
      />
      {matches.length > 0 && (
        <ul className="bg-white border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100" data-testid="sale-matches">
          {matches.map((b) => (
            <li key={b.id}>
              <button
                type="button" disabled={b.stock <= 0}
                onClick={() => { change(b, 1); setSearch(""); }}
                className="w-full text-left px-3 py-3 disabled:opacity-50"
              >
                <div className="font-medium">{b.title}</div>
                <div className="text-xs text-gray-500">{b.author} · {money(inPersonPrice(b))} · {b.stock > 0 ? `${b.stock} in stock` : "sold out"}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2" data-testid="sale-lines">
        {lines.map(({ book, quantity }) => (
          <div key={book.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="min-w-0 pr-2">
              <div className="font-medium truncate">{book.title}</div>
              <div className="text-xs text-gray-500">{money(inPersonPrice(book))} each</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => change(book, -1)} className="w-9 h-9 rounded border border-gray-300" aria-label={`Fewer ${book.title}`}>−</button>
              <span className="w-6 text-center" data-testid="sale-qty">{quantity}</span>
              <button type="button" onClick={() => change(book, 1)} disabled={quantity >= book.stock} className="w-9 h-9 rounded border border-gray-300 disabled:opacity-40" aria-label={`More ${book.title}`}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2" role="group" aria-label="Payment method">
        {METHODS.map((m) => (
          <button
            key={m.value} type="button" onClick={() => setMethod(m.value)} data-testid={`sale-method-${m.value}`}
            className={`flex-1 py-3 rounded border font-medium ${method === m.value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-300"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        type="button" onClick={record} disabled={lines.length === 0 || saving} data-testid="sale-record"
        className="w-full mt-4 py-4 rounded-xl bg-emerald-600 text-white text-lg font-semibold disabled:opacity-50"
      >
        {saving ? "Recording…" : lines.length ? `Record ${money(total)} ${method}` : "Add a book to record a sale"}
      </button>

      <h2 className="text-lg font-semibold mt-8 mb-2">Recent hand-recorded sales</h2>
      <div className="space-y-2" data-testid="sale-recent">
        {sales.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
        {sales.map((s) => (
          <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <div className="min-w-0 pr-2">
              <div className={s.refundedAt ? "line-through text-gray-400" : ""}>
                {money(s.finalTotal)} · {s.paymentMethod} · {s.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
              </div>
              <div className="text-xs text-gray-500">{s.location ?? "no venue"} · {s.paidAt ? new Date(s.paidAt).toLocaleString() : ""}{s.refundedAt ? " · undone" : ""}</div>
            </div>
            {!s.refundedAt && <button type="button" onClick={() => undo(s)} className="text-red-600 shrink-0 px-2 py-1">Undo</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
