export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between text-gray-500 text-sm">
        <div>&copy; {new Date().getFullYear()} Baytul Iqra Bookstore. All rights reserved.</div>
        <div className="flex gap-4 mt-2 md:mt-0">
          <a href="mailto:info@baytuliqra.com" className="hover:text-green-700">info@baytuliqra.com</a>
          {/* Social links placeholder */}
        </div>
      </div>
    </footer>
  );
} 