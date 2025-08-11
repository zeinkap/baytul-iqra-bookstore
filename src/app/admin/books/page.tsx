"use client";
import { useEffect, useRef, useState } from "react";
import Select, { MultiValue } from 'react-select';
import AdminNav from '@/components/AdminNav';

// Book type
interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  isBestseller: boolean;
  format?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState<Partial<Book>>({
    title: "",
    author: "",
    description: "",
    price: 0,
    images: [""],
    stock: 0,
    isBestseller: false,
    categories: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const formAnchorRef = useRef<HTMLDivElement | null>(null);
  const [searchText, setSearchText] = useState("");

  function isValidImageSrc(src: unknown): src is string {
    return (
      typeof src === 'string' &&
      src.trim().length > 0 &&
      (src.startsWith('/') || /^https?:\/\//.test(src))
    );
  }

  function normalizeImageInput(input: string): string {
    const value = (input || '').trim();
    if (!value) return '';
    if (value.startsWith('/') || /^https?:\/\//.test(value)) return value;
    // Auto-prefix bare filenames with our public images folder
    return `/book-images/${value}`;
  }

  // Fetch books and categories
  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm]);

  useEffect(() => {
    if (showForm && formAnchorRef.current) {
      formAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm]);

  async function fetchBooks() {
    setLoading(true);
    const res = await fetch("/api/books?bypassCache=1", { cache: 'no-store' });
    const data = await res.json();
    setBooks(data);
    setLoading(false);
  }
  async function fetchCategories() {
    const res = await fetch("/api/books/categories?bypassCache=1", { cache: 'no-store' });
    const data = await res.json();
    setCategories(data);
  }

  function startEdit(book: Book) {
    setForm({
      title: book.title,
      author: book.author,
      description: book.description,
      price: book.price,
      images: book.images.length > 0 ? book.images : [""],
      stock: book.stock,
      isBestseller: book.isBestseller,
      format: book.format || "",
      categories: book.categories,
    });
    setEditingBook(book);
    setShowForm(true);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function startAdd() {
    setForm({ title: "", author: "", description: "", price: 0, images: [""], stock: 0, isBestseller: false, format: "", categories: [] });
    setEditingBook(null);
    setShowForm(true);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    if (name.startsWith("images.")) {
      const idx = parseInt(name.split(".")[1], 10);
      setForm((f) => {
        const images = Array.isArray(f.images) ? [...f.images] : [""];
        images[idx] = normalizeImageInput(value);
        return { ...f, images };
      });
    } else {
      setForm((f) => ({ ...f, [name]: name === "price" || name === "stock" ? Number(value) : value }));
    }
  }
  // Helper to map categories to react-select format
  type Option = { value: string; label: string };
  const categoryOptions: Option[] = categories.map((c) => ({ value: c, label: c }));
  const selectedCategoryOptions: Option[] = (form.categories || []).map((c) => ({ value: c, label: c }));

  function handleCategoryChange(selected: MultiValue<Option>) {
    setForm((f) => ({ ...f, categories: selected ? selected.map((opt) => opt.value) : [] }));
  }

  function handleAddImageField() {
    setForm((f) => ({ ...f, images: [...(f.images || []), ""] }));
  }

  function handleRemoveImageField(idx: number) {
    setForm((f) => {
      const images = Array.isArray(f.images) ? [...f.images] : [];
      images.splice(idx, 1);
      return { ...f, images };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rawImages = Array.isArray(form.images) ? form.images : [];
    const trimmed = rawImages.map((i) => (typeof i === 'string' ? i.trim() : ''));
    const nonEmpty = trimmed.filter((i) => i.length > 0);
    const invalids = nonEmpty.filter((i) => !isValidImageSrc(i));
    if (invalids.length > 0) {
      setError("Image URL must start with '/' or 'http(s)'. Fix invalid entries or leave them blank.");
      return;
    }
    const finalImages = nonEmpty.filter(isValidImageSrc);
    if (!form.categories || form.categories.length === 0) {
      setError("At least one category is required.");
      return;
    }

    setLoading(true);
    try {
      const method = editingBook ? "PUT" : "POST";
      const url = editingBook ? `/api/books/${editingBook.id}` : "/api/books";
      
      const body = { ...form, images: finalImages };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to save book" }));
        throw new Error(errorData.error || "Failed to save book");
      }

      await fetchBooks();
      setEditingBook(null);
      setForm({ title: "", author: "", description: "", price: 0, images: [""], stock: 0, isBestseller: false, categories: [] });
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

  async function handleDelete(bookId: string) {
    if (!confirm("Are you sure you want to delete this book?")) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to delete book" }));
        throw new Error(errorData.error || "Failed to delete book");
      }
      await fetchBooks(); // Refresh the book list
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

  async function toggleBestseller(bookId: string, currentStatus: boolean) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBestseller: !currentStatus }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to update bestseller status" }));
        throw new Error(errorData.error || "Failed to update bestseller status");
      }
      await fetchBooks(); // Refresh the book list
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

  // Filter books by search text (title, author, or category)
  const filteredBooks = books.filter((book) => {
    const text = searchText.toLowerCase();
    return (
      book.title.toLowerCase().includes(text) ||
      book.author.toLowerCase().includes(text) ||
      book.categories.some((cat) => cat.toLowerCase().includes(text))
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-gray-900 bg-white min-h-screen">
      <AdminNav />
      <h1 className="text-3xl font-bold mb-6">Admin: Books</h1>
      <div className="mb-4">
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search by title, author, or category..."
          className="w-full md:w-1/2 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <button
        onClick={startAdd}
        className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
      >
        Add New Book
      </button>
      {loading && (
        <div className="flex items-center gap-2 text-blue-600 mb-4">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Loading...
        </div>
      )}
      {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 font-semibold flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" /></svg>{error}</div>}
      {/* Add/Edit Form */}
      <div ref={formAnchorRef} className="h-0" />
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-xl shadow p-6 mb-8 flex flex-col gap-4"
        >
          <h2 className="text-xl font-bold mb-2">{editingBook ? "Edit Book" : "Add New Book"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input name="title" value={form.title || ""} onChange={handleFormChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Author <span className="text-red-500">*</span>
              </label>
              <input name="author" value={form.author || ""} onChange={handleFormChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Format <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input name="format" value={form.format || ""} onChange={handleFormChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g., Paperback, Hardcover" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea name="description" value={form.description || ""} onChange={handleFormChange} required rows={3} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Image URLs <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              {(form.images || [""]).map((img, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    name={`images.${idx}`}
                    value={img}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder={`Image URL #${idx + 1}`}
                  />
                  {form.images && form.images.length > 1 && (
                    <button type="button" onClick={() => handleRemoveImageField(idx)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Remove</button>
                  )}
                </div>
              ))}
              <div className="text-xs text-gray-600 mt-1">
                Use paths like <code>/book-images/your-file.webp</code> or full URLs like <code>https://...</code>.
                Bare filenames (e.g., <code>cover.jpg</code>) will be saved as <code>/book-images/cover.jpg</code> automatically.
                Leave blank to use a placeholder.
              </div>
              <button type="button" onClick={handleAddImageField} className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">Add Image</button>
            </div>
            <div>
              <label className="block font-medium mb-1">Stock</label>
              <input name="stock" type="number" value={form.stock || 0} onChange={handleFormChange} min={0} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Price <span className="text-red-500">*</span>
              </label>
              <input name="price" type="number" step="0.01" value={form.price || 0} onChange={handleFormChange} min={0} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Categories <span className="text-red-500">*</span>
              </label>
              <Select
                isMulti
                options={categoryOptions}
                value={selectedCategoryOptions}
                onChange={handleCategoryChange}
                classNamePrefix="react-select"
                className="min-h-[60px]"
                placeholder="Select categories..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isBestseller"
                  checked={form.isBestseller || false}
                  onChange={(e) => setForm(f => ({ ...f, isBestseller: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="font-medium">Mark as Bestseller</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition disabled:opacity-60"
            >
              {editingBook ? "Update Book" : "Add Book"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingBook(null);
                setForm({ title: "", author: "", description: "", price: 0, images: [""], stock: 0, isBestseller: false, format: "", categories: [] });
                setShowForm(false);
              }}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {/* Book List */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl shadow p-4 overflow-x-auto">
        <table className="w-full text-sm md:text-base">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="font-semibold py-3 px-2 text-left">Title</th>
              <th className="font-semibold py-3 px-2 text-left hidden md:table-cell">Author</th>
              <th className="font-semibold py-3 px-2 text-left hidden md:table-cell">Format</th>
              <th className="font-semibold py-3 px-2 text-left hidden md:table-cell">Categories</th>
              <th className="font-semibold py-3 px-2 text-left">Stock</th>
              <th className="font-semibold py-3 px-2 text-left">Price</th>
              <th className="font-semibold py-3 px-2 text-left">Bestseller</th>
              <th className="font-semibold py-3 px-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">No books found.</td>
              </tr>
            ) : filteredBooks.map((book, idx) => (
              <tr
                key={book.id}
                className={
                  idx % 2 === 0
                    ? "bg-white hover:bg-blue-50 transition"
                    : "bg-gray-50 hover:bg-blue-50 transition"
                }
              >
                <td className="py-2 px-2 font-medium">{book.title}</td>
                <td className="py-2 px-2 hidden md:table-cell">{book.author}</td>
                <td className="py-2 px-2 hidden md:table-cell">{book.format}</td>
                <td className="py-2 px-2 hidden md:table-cell">{book.categories.join(", ")}</td>
                <td className="py-2 px-2">{book.stock}</td>
                <td className="py-2 px-2">${book.price.toFixed(2)}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => toggleBestseller(book.id, book.isBestseller)}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      book.isBestseller
                        ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {book.isBestseller ? '★ Bestseller' : 'Set as Bestseller'}
                  </button>
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => startEdit(book)}
                    className="text-blue-600 hover:underline mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(book.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 