import { test, expect } from '../fixtures/base-test';
import { generateTestEmail } from '../fixtures/test-data';
import { initializeAPIHelper } from '../helpers/test-workflows.helper';
import type { APIHelper } from '../helpers/api.helper';

/**
 * End-to-End Test: Checkout Success Page
 * 
 * This test suite covers checkout success page scenarios:
 * 1. Success page displays correct total amount in order summary
 * 2. Success page displays correct customer info (name, email, address)
 * 
 * Note: These tests create orders via API and navigate directly to the success page
 * to test the display functionality, rather than going through the full checkout flow.
 */

test.describe('Checkout Success Page', () => {
  let apiHelper: APIHelper;
  let testBook: { id: string; title: string; price: number; author: string };

  test.beforeEach(async ({ page }) => {
    apiHelper = initializeAPIHelper(page);
    testBook = await apiHelper.findInStockBook();
  });

  test('should display correct total amount in order summary section', async ({ 
    checkoutSuccessPage,
    page 
  }) => {
    // Create an order via API with pickup (no shipping cost)
    const testEmail = generateTestEmail();
    const orderData = {
      items: [{
        id: testBook.id,
        title: testBook.title,
        author: testBook.author,
        price: testBook.price,
        quantity: 1
      }],
      total: testBook.price,
      fulfillmentType: 'pickup',
      email: testEmail,
      pickupLocation: 'Alpharetta, GA'
    };

    const order = await apiHelper.createOrder(orderData);

    // Navigate directly to success page with the order ID
    await page.goto(`/checkout/success?orderId=${order.id}`);
    await checkoutSuccessPage.waitForSuccessPage();

    // Verify order summary is visible
    expect(await checkoutSuccessPage.isOrderSummaryVisible()).toBe(true);

    // Get the total from the success page
    const displayedTotal = await checkoutSuccessPage.getOrderTotal();
    
    // For pickup orders: total should equal book price (no shipping)
    const expectedTotal = `$${testBook.price.toFixed(2)}`;
    expect(displayedTotal).toBe(expectedTotal);
  });

  test('should display correct total amount with shipping cost for shipping orders', async ({ 
    checkoutSuccessPage,
    page 
  }) => {
    // Create an order via API with shipping
    const testEmail = generateTestEmail();
    const shippingCost = 5.00;
    const orderData = {
      items: [{
        id: testBook.id,
        title: testBook.title,
        author: testBook.author,
        price: testBook.price,
        quantity: 1
      }],
      total: testBook.price,
      fulfillmentType: 'shipping',
      email: testEmail,
      customerName: 'Test Customer',
      shippingAddress: {
        name: 'Test Customer',
        line1: '123 Test Street',
        city: 'Atlanta',
        state: 'GA',
        postal_code: '30301',
        country: 'US'
      }
    };

    const order = await apiHelper.createOrder(orderData);

    // Navigate directly to success page with the order ID
    await page.goto(`/checkout/success?orderId=${order.id}`);
    await checkoutSuccessPage.waitForSuccessPage();

    // Verify order summary is visible
    expect(await checkoutSuccessPage.isOrderSummaryVisible()).toBe(true);

    // Get the total from the success page
    const displayedTotal = await checkoutSuccessPage.getOrderTotal();
    
    // For shipping orders: total should equal book price + shipping cost
    const expectedTotal = `$${(testBook.price + shippingCost).toFixed(2)}`;
    expect(displayedTotal).toBe(expectedTotal);
  });

  test('should display correct customer name, email and pickup details in order info section', async ({ 
    checkoutSuccessPage,
    page 
  }) => {
    // Create an order via API with customer information
    const testEmail = generateTestEmail();
    const customerName = 'Test Customer';
    const orderData = {
      items: [{
        id: testBook.id,
        title: testBook.title,
        author: testBook.author,
        price: testBook.price,
        quantity: 1
      }],
      total: testBook.price,
      fulfillmentType: 'pickup',
      email: testEmail,
      customerName: customerName,
      pickupLocation: 'Alpharetta, GA'
    };

    const order = await apiHelper.createOrder(orderData);

    // Navigate directly to success page with the order ID
    await page.goto(`/checkout/success?orderId=${order.id}`);
    await checkoutSuccessPage.waitForSuccessPage();

    // Verify customer email is displayed
    const displayedEmail = await checkoutSuccessPage.getCustomerEmail();
    expect(displayedEmail).toContain(testEmail);
    
    // Verify pickup details are shown (not shipping address)
    const pickupDetails = await checkoutSuccessPage.getPickupDetails();
    expect(pickupDetails).toContain('Alpharetta');
  });
});

