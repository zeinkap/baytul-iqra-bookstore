"use client";

import { use, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '@/components/WishlistProvider';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';
import { toast } from 'react-hot-toast';
import Button from '@/components/Button';

type BookStock = {
  id: string;
  stock: number;
};

export default function WishlistPage({
  params,
  searchParams,
}: {
  params?: Promise<{ [key: string]: string | string[] | undefined }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Unwrap params and searchParams to prevent enumeration errors
  if (params) use(params);
  if (searchParams) use(searchParams);

  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();
  const [loading, setLoading] = useState(true);
  const [bookStocks, setBookStocks] = useState<BookStock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);

  // Fetch stock information for all books in wishlist
  useEffect(() => {
    const fetchBookStocks = async () => {
      if (wishlist.length === 0) {
        setLoadingStocks(false);
        setLoading(false);
        return;
      }

      try {
        const stockPromises = wishlist.map(async (item) => {
          try {
            const response = await fetch(`/api/books/${item.id}`);
            if (response.ok) {
              const book = await response.json();
              return { id: item.id, stock: book.stock };
            }
            return { id: item.id, stock: 0 };
          } catch (error) {
            console.error(`Error fetching stock for book ${item.id}:`, error);
            return { id: item.id, stock: 0 };
          }
        });

        const stocks = await Promise.all(stockPromises);
        setBookStocks(stocks);
      } catch (error) {
        console.error('Error fetching book stocks:', error);
      } finally {
        setLoadingStocks(false);
        setLoading(false);
      }
    };

    fetchBookStocks();
  }, [wishlist]);

  const getBookStock = (id: string): number => {
    const stockInfo = bookStocks.find((s) => s.id === id);
    return stockInfo ? stockInfo.stock : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 py-16">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                My Wishlist
              </h1>
              <p className="text-lg text-gray-600">
                {wishlist.length === 0
                  ? 'Your wishlist is empty'
                  : `${wishlist.length} book${wishlist.length !== 1 ? 's' : ''} saved for later`}
              </p>
            </div>
            {wishlist.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  clearWishlist();
                  toast.success('Wishlist cleared', {
                    style: {
                      background: '#ef4444',
                      color: '#fff',
                    },
                  });
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Wishlist Items */}
        {wishlist.length === 0 ? (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Your wishlist is empty
              </h3>
              <p className="text-gray-500 mb-6">
                Start adding books to your wishlist by clicking the heart icon on any book
              </p>
              <Link href="/">
                <Button>Browse Books</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlist.map((item) => (
              <div
                key={item.id}
                className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 group"
              >
                <Link href={`/books/${item.id}`} className="block">
                  {/* Book Image */}
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                    <Image
                      src={item.image || '/placeholder.svg'}
                      alt={item.title}
                      fill
                      className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      loading="lazy"
                    />
                    {/* Remove from wishlist button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFromWishlist(item.id);
                        toast.success(`"${item.title}" removed from wishlist`, {
                          style: {
                            background: '#ef4444',
                            color: '#fff',
                          },
                          iconTheme: {
                            primary: '#fff',
                            secondary: '#ef4444',
                          },
                        });
                      }}
                      className="absolute top-3 left-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 z-10"
                      aria-label="Remove from wishlist"
                    >
                      <svg
                        className="w-5 h-5 text-red-500 fill-red-500"
                        fill="currentColor"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Book Details */}
                  <div className="p-6 pb-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">by {item.author}</p>

                    {/* Format */}
                    {item.format && (
                      <div className="mb-3">
                        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-100">
                          {item.format}
                        </span>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold text-emerald-600">
                          ${item.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">Tax included</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Stock Status */}
                {!loadingStocks && (
                  <div className="px-6 pb-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      getBookStock(item.id) === 0 ? 'bg-red-50 border border-red-200 text-red-700' : 
                      getBookStock(item.id) === 1 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 
                      'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        getBookStock(item.id) === 0 ? 'bg-red-500' : 
                        getBookStock(item.id) === 1 ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      }`} />
                      <span>
                        {getBookStock(item.id) === 0 ? 'Out of Stock' : 
                         getBookStock(item.id) === 1 ? 'Only 1 left!' : 
                         `${getBookStock(item.id)} in stock`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Add to Cart button */}
                <div className="px-6 pb-6">
                  <AddToCartButtonClient
                    id={item.id}
                    title={item.title}
                    author={item.author}
                    price={item.price}
                    image={item.image}
                    format={item.format}
                    stock={getBookStock(item.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

