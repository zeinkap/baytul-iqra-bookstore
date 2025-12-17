"use client";
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';
import { useEffect, useState } from 'react';
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
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    loop: true,
    slides: { perView: 1 },
    mode: 'snap',
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel);
    },
  });
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Autoplay - only run if we have books and slider is initialized
  useEffect(() => {
    if (!mounted || heroBooks.length === 0 || !instanceRef.current) return;
    
    const interval = setInterval(() => {
      if (instanceRef.current) {
        instanceRef.current.next();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [instanceRef, mounted, heroBooks.length]);

  if (!mounted || heroBooks.length === 0) return null;

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center text-emerald-800 mb-4 sm:mb-6 tracking-tight">New Arrivals</h2>
      <div ref={sliderRef} className="keen-slider rounded-xl sm:rounded-2xl shadow-xl bg-white">
        {heroBooks.map((book) => (
          <div key={book.id} className="keen-slider__slide flex flex-col items-center p-4 sm:p-6">
            <Image
              src={book.images && book.images[0] ? book.images[0] : '/book-hero.png'}
              alt={book.title}
              width={320}
              height={400}
              className="rounded-lg sm:rounded-xl object-contain max-h-48 sm:max-h-64 md:max-h-80 mb-3 sm:mb-4 shadow"
              priority
              style={{ height: 'auto' }}
              sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, 400px"
            />
            <div className="text-sm sm:text-base md:text-lg font-semibold text-center mb-2 line-clamp-2 text-gray-900 px-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>{book.title}</div>
            <Button asChild variant="primary" className="mt-2 text-xs sm:text-sm px-4 sm:px-6 py-2 sm:py-3">
              <a href={`/books/${book.id}`}>View Book</a>
            </Button>
          </div>
        ))}
      </div>
      {/* Dots navigation */}
      <div className="flex justify-center mt-3 sm:mt-4 gap-2">
        {heroBooks.map((_, idx) => (
          <button
            key={idx}
            onClick={() => instanceRef.current?.moveToIdx(idx)}
            className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-200 border border-emerald-400 touch-manipulation ${
              currentSlide === idx ? 'bg-emerald-600' : 'bg-emerald-200'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
} 