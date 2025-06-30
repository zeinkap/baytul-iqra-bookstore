import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-row items-center gap-3">
        <Image
          src="/logo-baytul-iqra.png"
          alt="Baytul Iqra Logo"
          width={32}
          height={32}
          className="object-contain w-8 h-8"
        />
        <div className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Baytul Iqra. All rights reserved.</div>
      </div>
    </footer>
  );
} 