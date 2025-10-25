import { APIRequestContext } from '@playwright/test';

/**
 * API Helper for test data setup and teardown
 * 
 * This helper provides methods to interact with the API for:
 * - Creating test data
 * - Cleaning up test data
 * - Validating API responses
 */

export class APIHelper {
  constructor(private request: APIRequestContext, private baseURL: string) {}

  /**
   * Get all books from the API
   */
  async getBooks() {
    const response = await this.request.get(`${this.baseURL}/api/books`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch books: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Get a specific book by ID
   */
  async getBook(bookId: string) {
    const response = await this.request.get(`${this.baseURL}/api/books/${bookId}`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch book ${bookId}: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Search for books by query
   */
  async searchBooks(query: string) {
    const response = await this.request.get(
      `${this.baseURL}/api/books/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to search books: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Get books by category
   */
  async getBooksByCategory(category: string) {
    const response = await this.request.get(
      `${this.baseURL}/api/books/category/${encodeURIComponent(category)}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to fetch books by category: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Validate a promo code
   */
  async validatePromoCode(code: string, orderTotal: number) {
    const response = await this.request.post(`${this.baseURL}/api/promo-codes/validate`, {
      data: { code, orderTotal }
    });
    return response.json();
  }

  /**
   * Create an order (useful for testing order-related scenarios)
   */
  async createOrder(orderData: {
    items: Array<{
      id: string;
      title: string;
      author: string;
      price: number;
      quantity: number;
    }>;
    total: number;
    fulfillmentType: string;
    email: string;
    pickupLocation?: string;
  }) {
    const response = await this.request.post(`${this.baseURL}/api/orders`, {
      data: orderData
    });
    if (!response.ok()) {
      throw new Error(`Failed to create order: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string) {
    const response = await this.request.get(`${this.baseURL}/api/orders/${orderId}`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch order ${orderId}: ${response.status()}`);
    }
    return response.json();
  }

  /**
   * Find a book that's in stock for testing
   */
  async findInStockBook() {
    const books = await this.getBooks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inStockBook = books.find((book: any) => book.stock > 0);
    if (!inStockBook) {
      throw new Error('No books with stock available for testing');
    }
    return inStockBook;
  }

  /**
   * Find multiple books in stock for testing cart scenarios
   */
  async findMultipleInStockBooks(count: number = 2) {
    const books = await this.getBooks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inStockBooks = books.filter((book: any) => book.stock > 0).slice(0, count);
    if (inStockBooks.length < count) {
      throw new Error(`Not enough books with stock available. Found ${inStockBooks.length}, needed ${count}`);
    }
    return inStockBooks;
  }

  /**
   * Find a book that's out of stock for testing
   */
  async findOutOfStockBook() {
    const books = await this.getBooks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outOfStockBook = books.find((book: any) => book.stock === 0);
    if (!outOfStockBook) {
      throw new Error('No books with zero stock available for testing');
    }
    return outOfStockBook;
  }
}

