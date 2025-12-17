"use client";

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from './CartProvider';
import AddToCartButtonClient from './AddToCartButtonClient';
import { Book } from './BookGrid';
import { toast } from 'react-hot-toast';

interface QuickViewModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickViewModal({ book, isOpen, onClose }: QuickViewModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const isValidImageSrc = (src: unknown): src is string =>
    typeof src === 'string' && src.trim().length > 0 && (src.startsWith('/') || /^https?:\/\//.test(src));

  const validImages = Array.isArray(book.images) ? book.images.filter(isValidImageSrc) : [];
  const firstImage = validImages[0] || '/placeholder.svg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all duration-200"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col lg:flex-row">
          {/* Left Side - Image */}
          <div className="lg:w-2/5 p-6 lg:p-8 bg-gradient-to-br from-gray-50 to-white">
            <div className="sticky top-8">
              <div className="relative aspect-[3/4] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <Image
                  src={firstImage}
                  alt={book.title}
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 768px) 100vw, 40vw"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Right Side - Details */}
          <div className="lg:w-3/5 p-6 lg:p-8">
            <div className="max-w-2xl">
              {/* Title */}
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
                {book.title}
              </h2>

              {/* Author */}
              <p className="text-lg text-gray-600 mb-4">by {book.author}</p>

              {/* Categories */}
              {book.categories && book.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {book.categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-block bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium border border-emerald-100"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Format */}
              {book.format && (
                <div className="mb-4">
                  <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                    {book.format}
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="mb-6">
                <div className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg">
                  <span className="text-2xl font-bold">${book.price.toFixed(2)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-500">Tax included</div>
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    book.stock > 0
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      book.stock > 0 ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs text-gray-500">Availability</div>
                    <div
                      className={`text-sm font-medium ${
                        book.stock > 0 ? 'text-blue-700' : 'text-red-700'
                      }`}
                    >
                      {book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <div
                  className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: book.description }}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <AddToCartButtonClient
                    id={book.id}
                    title={book.title}
                    author={book.author}
                    price={book.price}
                    image={firstImage}
                    stock={book.stock}
                    format={book.format}
                  />
                </div>
                <Link
                  href={`/books/${book.id}`}
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  onClick={onClose}
                >
                  View Full Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

