"use client";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

type Status = "new" | "in-progress" | "fulfilled";
interface Feedback {
  id: string;
  message: string;
  location: string | null;
  status: Status;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = { new: "New", "in-progress": "In progress", fulfilled: "Fulfilled" };
const STATUS_STYLE: Record<Status, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-amber-50 text-amber-800 border-amber-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const FILTERS: { value: "all" | Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in-progress", label: "In progress" },
  { value: "fulfilled", label: "Fulfilled" },
];

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load requests"))))
      .then((d) => setItems(d.feedback))
      .catch((e) => setError(e.message));
  }, []);

  async function setStatus(item: Feedback, status: Status) {
    const res = await fetch(`/api/admin/feedback/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Could not update the request");
      return;
    }
    setItems((list) => list && list.map((f) => (f.id === item.id ? { ...f, status } : f)));
  }

  async function remove(item: Feedback) {
    if (!confirm("Delete this request? This can't be undone.")) return;
    const res = await fetch(`/api/admin/feedback/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the request");
      return;
    }
    setItems((list) => list && list.filter((f) => f.id !== item.id));
  }

  const count = (s: "all" | Status) => (items ?? []).filter((f) => s === "all" || f.status === s).length;
  const shown = (items ?? []).filter((f) => filter === "all" || f.status === filter);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-gray-900">
      <h1 className="text-2xl font-bold mb-1">Book Requests</h1>
      <p className="text-sm text-gray-600 mb-4">
        Answers to “What book do you wish we had here?” from the receipt page, newest first. Mark each one as you work on it.
      </p>
      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-gray-600">Loading…</p>}

      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter requests">
          {FILTERS.map((f) => (
            <button
              key={f.value} type="button" onClick={() => setFilter(f.value)} data-testid={`feedback-filter-${f.value}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${filter === f.value ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-300"}`}
            >
              {f.label} ({count(f.value)})
            </button>
          ))}
        </div>
      )}

      {items && items.length === 0 && <p className="text-gray-500">No requests yet.</p>}
      {items && items.length > 0 && shown.length === 0 && <p className="text-gray-500">Nothing in this view.</p>}
      <ul className="space-y-3" data-testid="feedback-list">
        {shown.map((f) => (
          <li key={f.id} className="bg-white rounded-xl shadow border border-gray-100 p-4" data-testid="feedback-item" data-status={f.status}>
            <div className="flex items-start justify-between gap-3">
              <p className={`whitespace-pre-line ${f.status === "fulfilled" ? "text-gray-400 line-through" : ""}`}>{f.message}</p>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[f.status]}`} data-testid="feedback-status">{STATUS_LABEL[f.status]}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {new Date(f.createdAt).toLocaleString()}
              {f.location ? ` · ${f.location}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-sm">
              {f.status !== "in-progress" && f.status !== "fulfilled" && (
                <button type="button" onClick={() => setStatus(f, "in-progress")} className="px-3 py-1.5 rounded border border-amber-300 text-amber-800 bg-amber-50" data-testid="feedback-in-progress">Mark in progress</button>
              )}
              {f.status !== "fulfilled" && (
                <button type="button" onClick={() => setStatus(f, "fulfilled")} className="px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 bg-emerald-50" data-testid="feedback-fulfilled">Mark fulfilled</button>
              )}
              {f.status !== "new" && (
                <button type="button" onClick={() => setStatus(f, "new")} className="px-3 py-1.5 rounded border border-gray-300 bg-white" data-testid="feedback-reopen">Reopen</button>
              )}
              <button type="button" onClick={() => remove(f)} className="px-3 py-1.5 rounded border border-red-200 text-red-600 bg-white ml-auto" data-testid="feedback-delete">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
