"use client";
import Image from 'next/image';
import Link from 'next/link';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

export default function BookDetailClient({ book }: { book: Book }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Header with back button */}
      <div className="max-w-6xl mx-auto px-4 py-8">
                 <Link href="/" className="inline-flex items-center gap-2 bg-white/90 hover:bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 px-5 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 mb-8 font-medium text-sm backdrop-blur-sm group cursor-pointer">
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all books
        </Link>
        
        {/* Main content card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Left side - Image section */}
            <div className="lg:w-2/5 p-8 bg-gradient-to-br from-gray-50 to-white">
              <div className="sticky top-8">
                <div className="relative group">
                  {/* Image container with enhanced styling */}
                  <div 
                    className="relative w-full aspect-[3/4] max-w-sm mx-auto bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-zoom-in overflow-hidden border border-gray-100 group-hover:scale-[1.02]" 
                    onClick={() => setLightboxOpen(true)}
                  >
          <Image
                      src={book.images && book.images[selectedImageIdx] ? book.images[selectedImageIdx] : '/placeholder.svg'}
            alt={book.title}
            fill
                      className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 40vw"
            priority={true}
            style={{ objectFit: 'contain' }}
          />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 rounded-2xl" />
                    <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                      🔍 Click to enlarge
                    </span>
                  </div>
                  
                  {/* Thumbnails row */}
                  {book.images && book.images.length > 1 && (
                    <div className="flex gap-2 mt-4 justify-center">
                      {book.images.map((img, idx) => (
                        <button
                          key={img + idx}
                          type="button"
                          onClick={() => setSelectedImageIdx(idx)}
                          className={`relative w-14 h-14 rounded-lg border-2 transition-all duration-200 overflow-hidden focus:outline-none ${selectedImageIdx === idx ? 'border-emerald-500 shadow-lg' : 'border-gray-200'}`}
                          tabIndex={0}
                          aria-label={`Show image ${idx + 1}`}
                        >
                          <Image
                            src={img}
                            alt={book.title + ' thumbnail ' + (idx + 1)}
                            fill
                            className="object-contain"
                            sizes="56px"
                            style={{ objectFit: 'contain' }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Add to Cart button with enhanced styling */}
                  <div className="mt-6 flex justify-center">
                    <div className="transform hover:scale-105 transition-transform duration-200">
                      <AddToCartButtonClient id={book.id} title={book.title} author={book.author} price={book.price} image={book.images && book.images[0] ? book.images[0] : ''} />
                    </div>
                  </div>
                </div>
        </div>
            </div>
            
            {/* Right side - Book details */}
            <div className="lg:w-3/5 p-8 lg:p-12">
              <div className="max-w-2xl">
                {/* Title with enhanced typography */}
                <h1 className="text-3xl lg:text-5xl font-bold mb-6 text-gray-900 leading-tight tracking-tight">
                  {book.title}
                </h1>
                
                {/* Author with enhanced styling */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-lg font-semibold text-gray-700">by {book.author}</span>
                </div>
                {/* Categories */}
                {book.categories && book.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {book.categories.map((cat) => (
                      <span key={cat} className="inline-block bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium border border-emerald-100">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                
                                 {/* Price with enhanced design */}
                 <div className="mb-6">
                   <div className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl shadow-sm">
                     <span className="text-sm font-bold">${book.price.toFixed(2)}</span>
                   </div>
                 </div>
                
                {/* Status badges with improved layout */}
                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-600">Added {new Date(book.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${book.stock > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className={`w-2 h-2 rounded-full ${book.stock > 0 ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <span className={`text-sm font-medium ${book.stock > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                  {book.stock === 1 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 border border-amber-200">
                      <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V7h2v2z" />
                      </svg>
                      <span className="text-sm font-semibold text-amber-800">Only 1 left!</span>
                    </div>
                  )}
                </div>
                
                                 {/* Description with enhanced styling */}
                 <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                   <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                     <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     About this book
                   </h3>
                   <div 
                     className="text-gray-800 text-base leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0 [&>p]:text-gray-800" 
                     dangerouslySetInnerHTML={{ __html: book.description }} 
                   />
                 </div>
              </div>
          </div>
          </div>
        </div>
      </div>
      
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={(book.images && book.images.length > 0 ? book.images : ['/placeholder.svg']).map((img) => ({ src: img, alt: book.title }))}
        index={selectedImageIdx}
      />
    </main>
  );
} 