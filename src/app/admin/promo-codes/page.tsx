"use client";
import { useEffect, useState } from "react";
import AdminNav from '@/components/AdminNav';

// PromoCode type
interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minimumOrderAmount: number | null;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<Partial<PromoCode>>({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: 0,
    minimumOrderAmount: null,
    maxUses: null,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: null,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch promo codes
  useEffect(() => {
    fetchPromoCodes();
  }, []);

  async function fetchPromoCodes() {
    setLoading(true);
    try {
      const res = await fetch("/api/promo-codes");
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch promo codes");
      }
      
      if (!Array.isArray(data)) {
        console.error("Expected array but got:", data);
        setPromoCodes([]);
        setError("Invalid data format received");
        return;
      }
      
      setPromoCodes(data);
      setError(null);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      setPromoCodes([]);
      setError(error instanceof Error ? error.message : "Failed to fetch promo codes");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(promoCode: PromoCode) {
    setEditingPromoCode(promoCode);
    setForm({
      ...promoCode,
      validFrom: new Date(promoCode.validFrom).toISOString().split('T')[0],
      validUntil: promoCode.validUntil ? new Date(promoCode.validUntil).toISOString().split('T')[0] : null,
    });
    setShowForm(true);
  }

  function startAdd() {
    setEditingPromoCode(null);
    setForm({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: 0,
      minimumOrderAmount: null,
      maxUses: null,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: null,
      isActive: true,
    });
    setShowForm(true);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((f) => ({ ...f, [name]: checked }));
    } else if (type === 'number') {
      setForm((f) => ({ ...f, [name]: value === '' ? null : Number(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code || !form.description || !form.discountValue) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const method = editingPromoCode ? "PUT" : "POST";
      const url = editingPromoCode ? `/api/promo-codes/${editingPromoCode.id}` : "/api/promo-codes";
      
      const body = {
        ...form,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : new Date().toISOString(),
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to save promo code" }));
        throw new Error(errorData.error || "Failed to save promo code");
      }

      await fetchPromoCodes();
      setEditingPromoCode(null);
      setForm({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: 0,
        minimumOrderAmount: null,
        maxUses: null,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: null,
        isActive: true,
      });
      setShowForm(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(promoCodeId: string) {
    if (!confirm("Are you sure you want to delete this promo code?")) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/promo-codes/${promoCodeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to delete promo code" }));
        throw new Error(errorData.error || "Failed to delete promo code");
      }
      await fetchPromoCodes();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(promoCodeId: string, currentStatus: boolean) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/promo-codes/${promoCodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to update promo code" }));
        throw new Error(errorData.error || "Failed to update promo code");
      }
      await fetchPromoCodes();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-gray-900 bg-white min-h-screen">
      <AdminNav />
      <h1 className="text-3xl font-bold mb-6">Admin: Promo Codes</h1>
      
      <button
        onClick={startAdd}
        className="mb-6 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
      >
        Add New Promo Code
      </button>

      {loading && (
        <div className="flex items-center gap-2 text-emerald-600 mb-4">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
          </svg>
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-xl shadow p-6 mb-8 flex flex-col gap-4"
        >
          <h2 className="text-xl font-bold mb-2">
            {editingPromoCode ? "Edit Promo Code" : "Add New Promo Code"}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                name="code"
                value={form.code || ""}
                onChange={handleFormChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., WELCOME10"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                name="description"
                value={form.description || ""}
                onChange={handleFormChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., Welcome discount - 10% off"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">
                Discount Type <span className="text-red-500">*</span>
              </label>
              <select
                name="discountType"
                value={form.discountType || "percentage"}
                onChange={handleFormChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">
                Discount Value <span className="text-red-500">*</span>
              </label>
              <input
                name="discountValue"
                type="number"
                step={form.discountType === "percentage" ? "1" : "0.01"}
                value={form.discountValue || 0}
                onChange={handleFormChange}
                required
                min="0"
                max={form.discountType === "percentage" ? "100" : undefined}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder={form.discountType === "percentage" ? "10" : "5.00"}
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Minimum Order Amount</label>
              <input
                name="minimumOrderAmount"
                type="number"
                step="0.01"
                value={form.minimumOrderAmount || ""}
                onChange={handleFormChange}
                min="0"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., 25.00"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Maximum Uses</label>
              <input
                name="maxUses"
                type="number"
                value={form.maxUses || ""}
                onChange={handleFormChange}
                min="1"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="e.g., 100"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Valid From</label>
              <input
                name="validFrom"
                type="date"
                value={form.validFrom || ""}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Valid Until</label>
              <input
                name="validUntil"
                type="date"
                value={form.validUntil || ""}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  name="isActive"
                  type="checkbox"
                  checked={form.isActive || false}
                  onChange={handleFormChange}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition disabled:opacity-60"
            >
              {editingPromoCode ? "Update Promo Code" : "Add Promo Code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingPromoCode(null);
                setForm({
                  code: "",
                  description: "",
                  discountType: "percentage",
                  discountValue: 0,
                  minimumOrderAmount: null,
                  maxUses: null,
                  validFrom: new Date().toISOString().split('T')[0],
                  validUntil: null,
                  isActive: true,
                });
                setShowForm(false);
              }}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Promo Codes List */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl shadow p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="font-semibold py-3 px-2 text-left">Code</th>
              <th className="font-semibold py-3 px-2 text-left">Description</th>
              <th className="font-semibold py-3 px-2 text-left">Discount</th>
              <th className="font-semibold py-3 px-2 text-left">Min Order</th>
              <th className="font-semibold py-3 px-2 text-left">Usage</th>
              <th className="font-semibold py-3 px-2 text-left">Status</th>
              <th className="font-semibold py-3 px-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(promoCodes) || promoCodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">
                  No promo codes found.
                </td>
              </tr>
            ) : (
              promoCodes.map((promoCode, idx) => (
                <tr
                  key={promoCode.id}
                  className={
                    idx % 2 === 0
                      ? "bg-white hover:bg-emerald-50 transition"
                      : "bg-gray-50 hover:bg-emerald-50 transition"
                  }
                >
                  <td className="py-2 px-2 font-mono font-medium">
                    {promoCode.code}
                  </td>
                  <td className="py-2 px-2">{promoCode.description}</td>
                  <td className="py-2 px-2">
                    {promoCode.discountType === "percentage" 
                      ? `${promoCode.discountValue}%` 
                      : `$${promoCode.discountValue.toFixed(2)}`
                    }
                  </td>
                  <td className="py-2 px-2">
                    {promoCode.minimumOrderAmount 
                      ? `$${promoCode.minimumOrderAmount.toFixed(2)}` 
                      : "None"
                    }
                  </td>
                  <td className="py-2 px-2">
                    {promoCode.currentUses}
                    {promoCode.maxUses && ` / ${promoCode.maxUses}`}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        promoCode.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {promoCode.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(promoCode)}
                        className="text-emerald-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(promoCode.id, promoCode.isActive)}
                        className={`text-sm ${
                          promoCode.isActive 
                            ? "text-orange-600 hover:underline" 
                            : "text-emerald-600 hover:underline"
                        }`}
                      >
                        {promoCode.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(promoCode.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 