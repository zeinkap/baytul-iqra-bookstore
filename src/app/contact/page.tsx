"use client";
import { useState } from 'react';
import { Card } from '@/components/Card';
import Image from 'next/image';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        // Reset success message after 5 seconds
        setTimeout(() => setSubmitStatus('idle'), 5000);
      } else {
        const errorData = await response.json();
        console.error('Form submission error:', errorData);
        setSubmitStatus('error');
        // Reset error message after 5 seconds
        setTimeout(() => setSubmitStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
      // Reset error message after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center shadow-xl bg-white">
                <Image
                  src="/logo-baytul-iqra.png"
                  alt="Baytul Iqra Logo"
                  width={96}
                  height={96}
                  className="object-contain w-20 h-20"
                  priority
                />
              </div>
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-4">
              Get in Touch
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Have questions about our books? Need help with your order? We&apos;re here to help you find your next meaningful read.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <Card.Header>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
                <p className="text-gray-600">Reach out to us through any of these channels</p>
              </Card.Header>
              <Card.Body>
                <div className="space-y-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                      <a href="mailto:sales@baytuliqra.com" className="text-emerald-600 hover:text-emerald-700 transition-colors">
                        sales@baytuliqra.com
                      </a>
                      <p className="text-sm text-gray-500 mt-1">We typically respond within 48 hours</p>
                    </div>
                  </div>



                  {/* Bulk Orders */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Bulk Orders</h3>
                      <p className="text-gray-700">Special pricing for schools, masjids, and organizations</p>
                      <p className="text-sm text-gray-500 mt-1">Contact us for custom quotes</p>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <Card.Header>
                                 <h2 className="text-2xl font-bold text-gray-900 mb-2">Send us a Message</h2>
                 <p className="text-gray-600">Fill out the form below and we&apos;ll get back to you as soon as possible</p>
              </Card.Header>
              <Card.Body>
                                {submitStatus === 'success' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-600">Thank you for contacting us. We&apos;ll respond to your message within 48 hours.</p>
                  </div>
                ) : submitStatus === 'error' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Failed to Send</h3>
                    <p className="text-gray-600">Sorry, there was an error sending your message. Please try again or contact us directly at sales@baytuliqra.com</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                                                 <input
                           type="text"
                           id="name"
                           name="name"
                           value={formData.name}
                           onChange={handleInputChange}
                           required
                           className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white text-gray-900 placeholder-gray-500"
                           placeholder="Your full name"
                         />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                                                 <input
                           type="email"
                           id="email"
                           name="email"
                           value={formData.email}
                           onChange={handleInputChange}
                           required
                           className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white text-gray-900 placeholder-gray-500"
                           placeholder="your.email@example.com"
                         />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                        Subject *
                      </label>
                                             <select
                         id="subject"
                         name="subject"
                         value={formData.subject}
                         onChange={handleInputChange}
                         required
                         className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white text-gray-900"
                       >
                        <option value="">Select a subject</option>
                        <option value="general">General Inquiry</option>
                        <option value="order">Order Question</option>
                        <option value="bulk">Bulk Order Request</option>
                        <option value="suggestion">Book Suggestion</option>
                        <option value="support">Technical Support</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                        Message *
                      </label>
                                             <textarea
                         id="message"
                         name="message"
                         value={formData.message}
                         onChange={handleInputChange}
                         required
                         rows={6}
                         className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none bg-white text-gray-900 placeholder-gray-500"
                         placeholder="Tell us how we can help you..."
                       />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        * Required fields
                      </p>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending...
                          </span>
                        ) : (
                          'Send Message'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <Card>
            <Card.Header>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h2>
              <p className="text-gray-600">Find quick answers to common questions</p>
            </Card.Header>
            <Card.Body>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">How long does shipping take?</h3>
                    <p className="text-gray-600">Standard shipping typically takes 3-5 business days within the continental US. International shipping times vary by location.</p>
                  </div>
                                     <div>
                     <h3 className="font-semibold text-gray-900 mb-2">Do you ship internationally?</h3>
                     <p className="text-gray-600">Unfortunately, we do not ship internationally at this time.</p>
                   </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
                    <p className="text-gray-600">We accept all major credit cards for secure online transactions.</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Can I return or exchange books?</h3>
                    <p className="text-gray-600">Yes, we offer a 7-day return policy for books in new condition. You will be responsible for the return shipping postage fee. Contact us for return instructions.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Do you offer bulk discounts?</h3>
                    <p className="text-gray-600">Absolutely! We offer special pricing for schools, mosques, and organizations. Contact us for custom quotes.</p>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
} 