"use client";
import { useEffect, useState } from "react";

interface Feedback {
  id: string;
  message: string;
  location: string | null;
  createdAt: string;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load requests"))))
      .then((d) => setItems(d.feedback))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-gray-900">
      <h1 className="text-2xl font-bold mb-1">Book Requests</h1>
      <p className="text-sm text-gray-600 mb-4">
        Answers to “What book do you wish we had here?” from the receipt page, newest first.
      </p>
      {error && <p className="text-red-600">{error}</p>}
      {!items && !error && <p className="text-gray-600">Loading…</p>}
      {items && items.length === 0 && <p className="text-gray-500">No requests yet.</p>}
      <ul className="space-y-3" data-testid="feedback-list">
        {items?.map((f) => (
          <li key={f.id} className="bg-white rounded-xl shadow border border-gray-100 p-4">
            <p className="whitespace-pre-line">{f.message}</p>
            <p className="text-xs text-gray-500 mt-2">
              {new Date(f.createdAt).toLocaleString()}
              {f.location ? ` · ${f.location}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
