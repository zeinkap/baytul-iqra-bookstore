"use client";
import Image from 'next/image';
import Link from 'next/link';
import AddToCartButtonClient from '@/components/AddToCartButtonClient';
import { useState, useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { useCart } from '@/components/CartProvider';
import { toast } from 'react-hot-toast';

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

export default function BookDetailClient({ book, relatedBooks }: { book: Book; relatedBooks: Book[] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const { addToCart } = useCart();

  const isValidImageSrc = (src: unknown): src is string => {
    return (
      typeof src === 'string' &&
      src.trim().length > 0 &&
      (src.startsWith('/') || /^https?:\/\//.test(src))
    );
  };

  const validImages = Array.isArray(book.images)
    ? book.images.filter(isValidImageSrc)
    : [];
  const displayedIdx = Math.max(0, Math.min(selectedImageIdx, Math.max(0, validImages.length - 1)));

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Track scroll for floating action bar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 pb-40 lg:pb-0">
      {/* Floating Action Bar (Mobile) */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isScrolled ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={validImages[0] ? validImages[0] : '/placeholder.svg'}
                  alt={book.title}
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 line-clamp-1">{book.title}</div>
                <div className="text-lg font-bold text-emerald-600">${book.price.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3 py-2 rounded-lg font-semibold flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 group relative overflow-hidden text-sm"
                onClick={() => {
                  if (book.stock <= 0) {
                    toast.error('This item is out of stock', {
                      style: {
                        background: '#ef4444',
                        color: '#fff',
                      },
                      iconTheme: {
                        primary: '#fff',
                        secondary: '#ef4444',
                      },
                    });
                    return;
                  }
                  addToCart({ id: book.id, title: book.title, author: book.author, price: book.price, image: book.images && book.images[0] ? book.images[0] : '' });
                  toast.success('Added to cart!', {
                    style: {
                      background: '#f59e0b',
                      color: '#fff',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#f59e0b',
                    },
                  });
                }}
              >
                {/* Shine effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                
                {/* Button content */}
                <svg className="w-4 h-4 mr-1.5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="relative z-10 font-bold tracking-wide">Add to Cart</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header with enhanced back button */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-3 bg-white/90 hover:bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 mb-8 font-medium text-sm backdrop-blur-sm group cursor-pointer"
        >
          <svg className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all books
        </Link>
        
        {/* Main content card with enhanced styling */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Left side - Enhanced Image section */}
            <div className="lg:w-2/5 p-6 lg:p-8 bg-gradient-to-br from-gray-50 to-white">
              <div className="sticky top-8">
                <div className="relative group">
                  {/* Enhanced image container */}
                  <div 
                    className="relative w-full aspect-[3/4] max-w-sm mx-auto bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-zoom-in overflow-hidden border border-gray-100 group-hover:scale-[1.02]" 
                    onClick={() => setLightboxOpen(true)}
                  >
                    <Image
                      src={validImages[displayedIdx] ? validImages[displayedIdx] : '/placeholder.svg'}
                      alt={book.title}
                      fill
                      className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 40vw"
                      priority={true}
                      loading="eager"
                      fetchPriority="high"
                      style={{ objectFit: 'contain' }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 rounded-2xl" />
                    <div className="absolute bottom-4 right-4 bg-black/80 text-white text-xs px-3 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Click to enlarge
                    </div>
                  </div>
                  
                  {/* Enhanced thumbnails */}
                  {validImages.length > 1 && (
                    <div className="flex gap-3 mt-6 justify-center">
                      {validImages.map((img, idx) => (
                        <button
                          key={img + idx}
                          type="button"
                          onClick={() => setSelectedImageIdx(idx)}
                          className={`relative w-16 h-16 rounded-xl border-2 transition-all duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                            displayedIdx === idx 
                              ? 'border-emerald-500 shadow-lg scale-110' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          tabIndex={0}
                          aria-label={`Show image ${idx + 1}`}
                        >
                          <Image
                            src={img}
                            alt={book.title + ' thumbnail ' + (idx + 1)}
                            fill
                            className="object-contain"
                            sizes="64px"
                            loading="lazy"
                            style={{ objectFit: 'contain' }}
                          />
                          {displayedIdx === idx && (
                            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  
                    {/* Enhanced Add to Cart button - hidden on mobile (replaced by floating bar) */}
                   <div className="mt-8 flex justify-center hidden lg:block">
                     <div className="transform hover:scale-105 transition-transform duration-200 w-full max-w-xs">
                       <AddToCartButtonClient id={book.id} title={book.title} author={book.author} price={book.price} image={validImages[0] ? validImages[0] : ''} stock={book.stock} />
                     </div>
                   </div>
                   
                   {/* Mobile Add to Cart button - smaller size */}
                   <div className="mt-6 flex justify-center lg:hidden">
                     <div className="transform hover:scale-105 transition-transform duration-200 w-full max-w-xs">
                       <button
                         className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 group relative overflow-hidden text-sm"
                         onClick={() => {
                           if (book.stock <= 0) {
                             toast.error('This item is out of stock', {
                               style: {
                                 background: '#ef4444',
                                 color: '#fff',
                               },
                               iconTheme: {
                                 primary: '#fff',
                                 secondary: '#ef4444',
                               },
                             });
                             return;
                           }
                            addToCart({ id: book.id, title: book.title, author: book.author, price: book.price, image: validImages[0] ? validImages[0] : '' });
                           toast.success('Added to cart!', {
                             style: {
                               background: '#f59e0b',
                               color: '#fff',
                             },
                             iconTheme: {
                               primary: '#fff',
                               secondary: '#f59e0b',
                             },
                           });
                         }}
                       >
                         {/* Shine effect overlay */}
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                         
                         {/* Button content */}
                         <svg className="w-4 h-4 mr-2 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                         </svg>
                         <span className="relative z-10 font-bold tracking-wide">Add to Cart</span>
                       </button>
                     </div>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Right side - Enhanced Book details */}
            <div className="lg:w-3/5 p-6 lg:p-8 lg:pl-0">
              <div className="max-w-2xl">
                {/* Enhanced title with better typography */}
                <h1 className="text-2xl lg:text-4xl xl:text-5xl font-bold mb-4 lg:mb-6 text-gray-900 leading-tight tracking-tight">
                  {book.title}
                </h1>
                
                {/* Enhanced author section */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-gray-700">by {book.author}</span>
                    <div className="text-sm text-gray-500">Author</div>
                  </div>
                </div>

                {/* Enhanced categories */}
                {book.categories && book.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {book.categories.map((cat) => (
                      <span key={cat} className="inline-block bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-medium border border-emerald-100 hover:bg-emerald-100 transition-colors duration-200">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                
                                 {/* Enhanced price section */}
                 <div className="mb-8">
                   <div className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 lg:px-6 lg:py-3 rounded-xl shadow-lg">
                     <span className="text-lg lg:text-xl font-bold">${book.price.toFixed(2)}</span>
                   </div>
                   <div className="mt-2 flex items-center gap-2">
                     <span className="text-xs text-gray-500">Tax included</span>
                     <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                     </svg>
                   </div>
                 </div>
                
                {/* Enhanced status badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                    <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <div className="text-xs text-gray-500">Added</div>
                      <div className="text-sm font-medium text-gray-900">{new Date(book.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    book.stock > 0 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      book.stock > 0 ? 'bg-blue-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <div className="text-xs text-gray-500">Availability</div>
                      <div className={`text-sm font-medium ${
                        book.stock > 0 ? 'text-blue-700' : 'text-red-700'
                      }`}>
                        {book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}
                      </div>
                    </div>
                  </div>
                  
                  {book.stock === 1 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-100 border border-amber-200 sm:col-span-2 lg:col-span-1">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V7h2v2z" />
                      </svg>
                      <div>
                        <div className="text-xs text-amber-600">Limited Stock</div>
                        <div className="text-sm font-semibold text-amber-800">Only 1 left!</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Enhanced description section */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 lg:p-8 border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    About this book
                  </h3>
                  <div 
                    className="text-gray-800 text-base leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0 [&>p]:text-gray-800 prose prose-gray max-w-none" 
                    dangerouslySetInnerHTML={{ __html: book.description }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Related Books Section */}
      {relatedBooks.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              You May Also Like
            </h2>
            <p className="text-lg text-gray-600">
              More books in the same category.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {relatedBooks.map((relatedBook) => (
              <div key={relatedBook.id} className="group">
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl border border-white/50 overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1">
                  <Link href={`/books/${relatedBook.id}`} className="block">
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                      <Image
                        src={relatedBook.images && relatedBook.images[0] ? relatedBook.images[0] : '/placeholder.svg'}
                        alt={relatedBook.title}
                        fill
                        className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200 text-sm">
                        {relatedBook.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2">by {relatedBook.author}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-emerald-600">${relatedBook.price.toFixed(2)}</span>
                        <span className="text-xs text-gray-500">Tax included</span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={(validImages.length > 0 ? validImages : ['/placeholder.svg']).map((img) => ({ src: img, alt: book.title }))}
        index={displayedIdx}
      />
    </main>
  );
} 