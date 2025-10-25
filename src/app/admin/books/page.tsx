"use client";
import { useEffect, useRef, useState } from "react";
import Select, { MultiValue } from 'react-select';

// Book type
interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  costPrice?: number;
  shippingCost?: number;
  images: string[];
  stock: number;
  isBestseller: boolean;
  format?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

interface BookStats {
  totalBooks: number;
  totalInventoryValue: number;
  lowStockCount: number;
  bestsellerCount: number;
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [bestsellerFilter, setBestsellerFilter] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [stats, setStats] = useState<BookStats>({
    totalBooks: 0,
    totalInventoryValue: 0,
    lowStockCount: 0,
    bestsellerCount: 0,
  });

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

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  // ESC key to close form
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && showForm) {
        cancelForm();
      }
      if (e.key === 'Escape' && showDeleteConfirm) {
        setShowDeleteConfirm(false);
        setBookToDelete(null);
      }
    }
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showForm, showDeleteConfirm]);

  async function fetchBooks() {
    setLoading(true);
    const res = await fetch("/api/books?bypassCache=1", { cache: 'no-store' });
    const data = await res.json();
    setBooks(data);
    
    // Calculate stats
    const totalBooks = data.length;
    const totalInventoryValue = data.reduce((sum: number, book: Book) => sum + (book.price * book.stock), 0);
    const lowStockCount = data.filter((book: Book) => book.stock < 2).length;
    const bestsellerCount = data.filter((book: Book) => book.isBestseller).length;
    
    setStats({
      totalBooks,
      totalInventoryValue,
      lowStockCount,
      bestsellerCount,
    });
    
    setLoading(false);
  }
  
  async function fetchCategories() {
    const res = await fetch("/api/books/categories?bypassCache=1", { cache: 'no-store' });
    const data = await res.json();
    setCategories(data);
  }

  // Sorting function
  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Sort data based on current sort field and direction
  function getSortedData(data: Book[]) {
    return [...data].sort((a, b) => {
      let aValue: string | number | boolean;
      let bValue: string | number | boolean;

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'author':
          aValue = a.author.toLowerCase();
          bValue = b.author.toLowerCase();
          break;
        case 'format':
          aValue = (a.format || '').toLowerCase();
          bValue = (b.format || '').toLowerCase();
          break;
        case 'categories':
          aValue = a.categories.join(', ').toLowerCase();
          bValue = b.categories.join(', ').toLowerCase();
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'bestseller':
          aValue = a.isBestseller ? 1 : 0;
          bValue = b.isBestseller ? 1 : 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function startEdit(book: Book) {
    setForm({
      title: book.title,
      author: book.author,
      description: book.description,
      price: book.price,
      costPrice: book.costPrice,
      shippingCost: book.shippingCost,
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
  
  function cancelForm() {
    setEditingBook(null);
    setForm({ title: "", author: "", description: "", price: 0, images: [""], stock: 0, isBestseller: false, format: "", categories: [] });
    setShowForm(false);
    setError(null);
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
      setForm((f) => ({ ...f, [name]: name === "price" || name === "stock" || name === "costPrice" || name === "shippingCost" ? Number(value) : value }));
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
      cancelForm();
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

  function confirmDelete(bookId: string) {
    setBookToDelete(bookId);
    setShowDeleteConfirm(true);
  }

  async function handleDelete() {
    if (!bookToDelete) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to delete book" }));
        throw new Error(errorData.error || "Failed to delete book");
      }
      await fetchBooks();
      setShowDeleteConfirm(false);
      setBookToDelete(null);
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
      await fetchBooks();
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

  function exportToCSV() {
    const headers = ['Title', 'Author', 'Format', 'Categories', 'Stock', 'Price', 'Cost Price', 'Shipping Cost', 'Bestseller', 'Created At'];
    const rows = filteredBooks.map(book => [
      book.title,
      book.author,
      book.format || 'N/A',
      book.categories.join('; '),
      book.stock.toString(),
      `$${book.price.toFixed(2)}`,
      book.costPrice ? `$${book.costPrice.toFixed(2)}` : 'N/A',
      book.shippingCost ? `$${book.shippingCost.toFixed(2)}` : 'N/A',
      book.isBestseller ? 'Yes' : 'No',
      new Date(book.createdAt).toLocaleDateString(),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `books-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filter books by search text, category, stock level, and bestseller status
  const filteredBooks = books.filter((book) => {
    const text = debouncedSearch.toLowerCase();
    const matchesSearch = !debouncedSearch || (
      book.title.toLowerCase().includes(text) ||
      book.author.toLowerCase().includes(text) ||
      book.categories.some((cat) => cat.toLowerCase().includes(text))
    );
    
    const matchesCategory = !categoryFilter || book.categories.includes(categoryFilter);
    
    const matchesStock = !stockFilter || (
      (stockFilter === 'low' && book.stock < 2) ||
      (stockFilter === 'out' && book.stock === 0) ||
      (stockFilter === 'in' && book.stock > 0)
    );
    
    const matchesBestseller = !bestsellerFilter || (
      (bestsellerFilter === 'yes' && book.isBestseller) ||
      (bestsellerFilter === 'no' && !book.isBestseller)
    );
    
    return matchesSearch && matchesCategory && matchesStock && matchesBestseller;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-gray-900 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin: Books</h1>
        <button
          onClick={exportToCSV}
          disabled={filteredBooks.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold shadow transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow">
          <div className="text-sm text-blue-600 font-medium mb-1">Total Books</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalBooks}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow">
          <div className="text-sm text-green-600 font-medium mb-1">Inventory Value</div>
          <div className="text-2xl font-bold text-green-900">${stats.totalInventoryValue.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4 shadow">
          <div className="text-sm orange-600 font-medium mb-1">Low Stock Items</div>
          <div className="text-2xl font-bold text-orange-900">{stats.lowStockCount}</div>
          <div className="text-xs text-orange-700 mt-1">&lt; 2 units</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow">
          <div className="text-sm text-purple-600 font-medium mb-1">Bestsellers</div>
          <div className="text-2xl font-bold text-purple-900">{stats.bestsellerCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search by title, author, or category..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {searchText && (
            <div className="text-xs text-gray-500 mt-1">
              Searching...
            </div>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Stock Levels</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock (&lt; 2)</option>
          <option value="out">Out of Stock</option>
        </select>
        <select
          value={bestsellerFilter}
          onChange={(e) => setBestsellerFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Books</option>
          <option value="yes">Bestsellers Only</option>
          <option value="no">Non-Bestsellers</option>
        </select>
      </div>

      <button
        onClick={startAdd}
        className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
      >
        + Add New Book
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
              <input name="title" value={form.title || ""} onChange={handleFormChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Author <span className="text-red-500">*</span>
              </label>
              <input name="author" value={form.author || ""} onChange={handleFormChange} required className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Format <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input name="format" value={form.format || ""} onChange={handleFormChange} className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g., Paperback, Hardcover" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea name="description" value={form.description || ""} onChange={handleFormChange} required rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
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
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
              <input name="stock" type="number" value={form.stock || 0} onChange={handleFormChange} min={0} className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Price <span className="text-red-500">*</span>
              </label>
              <input name="price" type="number" step="0.01" value={form.price || 0} onChange={handleFormChange} min={0} required className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Cost Price <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input name="costPrice" type="number" step="0.01" value={form.costPrice || ""} onChange={handleFormChange} min={0} className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Enter cost price for profit tracking" />
            </div>
            <div>
              <label className="block font-medium mb-1">
                Shipping Cost <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input name="shippingCost" type="number" step="0.01" value={form.shippingCost || ""} onChange={handleFormChange} min={0} className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Estimate shipping cost per book" />
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
              onClick={cancelForm}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold shadow transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      
      {/* Book List */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl shadow p-4 overflow-x-auto">
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredBooks.length} of {books.length} books
        </div>
        <table className="w-full text-sm md:text-base">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th 
                className="font-semibold py-3 px-2 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center space-x-1">
                  <span>Title</span>
                  {sortField === 'title' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left hidden md:table-cell cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('author')}
              >
                <div className="flex items-center space-x-1">
                  <span>Author</span>
                  {sortField === 'author' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left hidden md:table-cell cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('format')}
              >
                <div className="flex items-center space-x-1">
                  <span>Format</span>
                  {sortField === 'format' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left hidden md:table-cell cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('categories')}
              >
                <div className="flex items-center space-x-1">
                  <span>Categories</span>
                  {sortField === 'categories' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('stock')}
              >
                <div className="flex items-center space-x-1">
                  <span>Stock</span>
                  {sortField === 'stock' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center space-x-1">
                  <span>Price</span>
                  {sortField === 'price' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="font-semibold py-3 px-2 text-left cursor-pointer hover:bg-gray-200 transition-colors select-none"
                onClick={() => handleSort('bestseller')}
              >
                <div className="flex items-center space-x-1">
                  <span>Bestseller</span>
                  {sortField === 'bestseller' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="font-semibold py-3 px-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">
                  {loading ? 'Loading books...' : 'No books found.'}
                </td>
              </tr>
            ) : getSortedData(filteredBooks).map((book, idx) => (
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
                <td className="py-2 px-2">
                  <span className={`${book.stock < 2 ? 'text-orange-600 font-semibold' : ''} ${book.stock === 0 ? 'text-red-600 font-bold' : ''}`}>
                    {book.stock}
                    {book.stock < 2 && book.stock > 0 && <span className="text-xs ml-1">⚠️</span>}
                    {book.stock === 0 && <span className="text-xs ml-1">❌</span>}
                  </span>
                </td>
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
                    onClick={() => confirmDelete(book.id)}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setShowDeleteConfirm(false);
            setBookToDelete(null);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Book</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this book? All data associated with this book will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold shadow transition disabled:opacity-60"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setBookToDelete(null);
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold shadow transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
