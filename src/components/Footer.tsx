import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-8 relative z-10">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-baytul-iqra.png"
            alt="Baytul Iqra Logo"
            width={32}
            height={32}
            className="object-contain w-8 h-8"
          />
          <div className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Baytul Iqra. All rights reserved.</div>
        </div>
        
        <div className="flex items-center gap-4">
          <a 
            href="mailto:sales@baytuliqra.com"
            className="text-gray-500 hover:text-emerald-600 text-sm font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            sales@baytuliqra.com
          </a>
        </div>
      </div>
    </footer>
  );
} 