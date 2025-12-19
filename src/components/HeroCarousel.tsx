"use client";
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';
import { useEffect, useState, useRef } from 'react';
import { Button } from './Button';
import Image from 'next/image';

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  format?: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

export default function HeroCarousel({ heroBooks }: { heroBooks: Book[] }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    slides: { perView: 1 },
    mode: 'snap',
    drag: true,
    created(slider) {
      slider.moveToIdx(0);
    },
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
  });
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Autoplay with pause on hover
  useEffect(() => {
    if (!mounted || heroBooks.length === 0 || !instanceRef.current || isPaused) return;
    
    intervalRef.current = setInterval(() => {
      if (instanceRef.current && !isPaused) {
        instanceRef.current.next();
      }
    }, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [instanceRef, mounted, heroBooks.length, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!instanceRef.current) return;
      if (e.key === 'ArrowLeft') {
        instanceRef.current.prev();
      } else if (e.key === 'ArrowRight') {
        instanceRef.current.next();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [instanceRef]);

  if (!mounted || heroBooks.length === 0) return null;

  return (
    <div className="w-full max-w-lg mx-auto relative">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center text-emerald-800 mb-4 sm:mb-6 tracking-tight">New Arrivals</h2>
      <div 
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setTimeout(() => setIsPaused(false), 1000)}
      >
        <div ref={sliderRef} className="keen-slider rounded-xl sm:rounded-2xl shadow-xl bg-white overflow-hidden">
          {heroBooks.map((book, index) => (
            <div key={book.id} className="keen-slider__slide flex flex-col items-center p-4 sm:p-6 md:p-8">
              <div className="relative w-full flex justify-center mb-3 sm:mb-4">
                <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-inner">
                  <Image
                    src={book.images && book.images[0] ? book.images[0] : '/book-hero.png'}
                    alt={book.title}
                    width={320}
                    height={400}
                    className="rounded-lg sm:rounded-xl object-contain max-h-48 sm:max-h-64 md:max-h-80 shadow-md transition-transform duration-300 hover:scale-105"
                    priority={index === 0}
                    style={{ height: 'auto' }}
                    sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, 400px"
                  />
                </div>
              </div>
              <div className="text-center mb-2 sm:mb-3 w-full px-2">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 mb-1 line-clamp-2 leading-tight">
                  {book.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-2">by {book.author}</p>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-base sm:text-lg md:text-xl font-bold text-emerald-600">
                    ${book.price.toFixed(2)}
                  </span>
                  {book.stock > 0 && (
                    <span className="text-xs text-gray-500">• In Stock</span>
                  )}
                </div>
              </div>
              <Button asChild variant="primary" className="mt-1 text-xs sm:text-sm px-5 sm:px-6 py-2 sm:py-3 shadow-md hover:shadow-lg transition-all duration-200">
                <a href={`/books/${book.id}`}>View Book</a>
              </Button>
            </div>
          ))}
        </div>
        
        {/* Left Arrow */}
        <button
          onClick={() => {
            instanceRef.current?.prev();
            setIsPaused(true);
            setTimeout(() => setIsPaused(false), 3000);
          }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white backdrop-blur-sm text-emerald-700 hover:text-emerald-800 rounded-full p-2.5 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation border border-emerald-100"
          aria-label="Previous slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {/* Right Arrow */}
        <button
          onClick={() => {
            instanceRef.current?.next();
            setIsPaused(true);
            setTimeout(() => setIsPaused(false), 3000);
          }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white backdrop-blur-sm text-emerald-700 hover:text-emerald-800 rounded-full p-2.5 sm:p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation border border-emerald-100"
          aria-label="Next slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {/* Enhanced Dots navigation */}
      <div className="flex justify-center items-center mt-4 sm:mt-5 gap-2">
        {heroBooks.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              instanceRef.current?.moveToIdx(idx);
              setIsPaused(true);
              setTimeout(() => setIsPaused(false), 3000);
            }}
            className={`rounded-full transition-all duration-300 touch-manipulation ${
              currentSlide === idx 
                ? 'w-8 h-2.5 sm:w-10 sm:h-3 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md' 
                : 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-emerald-200 hover:bg-emerald-300 border border-emerald-300'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
} 