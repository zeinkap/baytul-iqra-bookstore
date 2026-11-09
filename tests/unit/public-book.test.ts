import { describe, expect, it } from 'vitest';
import { withoutPrivateFields } from '@/lib/publicBook';

describe('Public book data', () => {
  it('drops what the shop pays (cost price, shipping cost) and keeps everything a customer sees', () => {
    const book = { id: 'b1', title: 'Book', price: 12, inShopPrice: 10, costPrice: 6.5, shippingCost: 2, stock: 3, categories: ['Fiqh'] };
    const result = withoutPrivateFields(book);
    expect(result).toEqual({ id: 'b1', title: 'Book', price: 12, inShopPrice: 10, stock: 3, categories: ['Fiqh'] });
    expect('costPrice' in result).toBe(false);
    expect('shippingCost' in result).toBe(false);
  });

  it('does not change the book it is given', () => {
    const book = { id: 'b1', costPrice: 6.5, shippingCost: 2 };
    withoutPrivateFields(book);
    expect(book).toEqual({ id: 'b1', costPrice: 6.5, shippingCost: 2 });
  });

  it('copes with books that have no cost set', () => {
    expect(withoutPrivateFields({ id: 'b1', costPrice: null, shippingCost: null, price: 5 })).toEqual({ id: 'b1', price: 5 });
  });
});
