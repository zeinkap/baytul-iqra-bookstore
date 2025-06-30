import { Card } from '@/components/Card';
import Image from 'next/image';

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <div className="flex justify-center mb-6">
        <Image
          src="/logo-baytul-iqra.png"
          alt="Baytul Iqra Logo"
          width={80}
          height={80}
          className="object-contain w-20 h-20"
          priority
        />
      </div>
      <Card>
        <Card.Header>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Contact Us</h1>
        </Card.Header>
        <Card.Body>
          <p className="mb-4 text-gray-800">
            For any questions or concerns, please reach out to us at{' '}
            <a href="mailto:zeinkap@gmail.com" className="text-emerald-800 underline">zeinkap@gmail.com</a>.
          </p>
          <p className="text-gray-800">
            Interested in placing a <span className="font-semibold">bulk order</span>? Contact us for a discounted price!
          </p>
        </Card.Body>
      </Card>
    </div>
  );
} 