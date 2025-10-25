import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface StripeSessionWithShipping extends Stripe.Checkout.Session {
  shipping_details?: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

async function backfillCustomerInfo() {
  console.log('Starting to backfill customer information...\n');

  try {
    // Find all shipping orders
    const allShippingOrders = await prisma.order.findMany({
      where: {
        fulfillmentType: 'shipping'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Filter orders that are missing customerName or shippingAddress
    const ordersNeedingInfo = allShippingOrders.filter(
      order => !order.customerName || !order.shippingAddress
    );

    console.log(`Found ${ordersNeedingInfo.length} orders missing customer information.\n`);

    if (ordersNeedingInfo.length === 0) {
      console.log('✓ All orders have complete customer information!');
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const order of ordersNeedingInfo) {
      try {
        console.log(`\nProcessing order ${order.id}:`);
        console.log(`  Created: ${order.createdAt}`);
        console.log(`  Email: ${order.email || 'N/A'}`);
        console.log(`  Has Customer Name: ${!!order.customerName}`);
        console.log(`  Has Shipping Address: ${!!order.shippingAddress}`);

        // Try to find the Stripe session for this order
        // Search for sessions created around the order creation time
        const orderTime = new Date(order.createdAt);
        const searchStart = Math.floor(orderTime.getTime() / 1000) - 3600; // 1 hour before
        const searchEnd = Math.floor(orderTime.getTime() / 1000) + 3600; // 1 hour after

        const sessions = await stripe.checkout.sessions.list({
          created: {
            gte: searchStart,
            lte: searchEnd
          },
          limit: 100
        });

        // Find the session with matching orderId in metadata
        const matchingSession = sessions.data.find(
          (s) => s.metadata?.orderId === order.id
        );

        if (!matchingSession) {
          console.log(`  ⚠ Could not find Stripe session for this order`);
          skippedCount++;
          continue;
        }

        console.log(`  ✓ Found matching Stripe session: ${matchingSession.id}`);

        // Extract customer information from session
        const sessionWithShipping = matchingSession as StripeSessionWithShipping;
        const customerDetails = matchingSession.customer_details;

        let shippingAddress: any = undefined;
        let customerName: string | undefined = undefined;

        // Extract shipping address
        if (sessionWithShipping.shipping_details?.address) {
          const shipDetails = sessionWithShipping.shipping_details;
          const address = shipDetails.address;
          shippingAddress = {
            name: shipDetails.name ?? undefined,
            line1: address.line1 ?? undefined,
            line2: address.line2 ?? undefined,
            city: address.city ?? undefined,
            state: address.state ?? undefined,
            postal_code: address.postal_code ?? undefined,
            country: address.country ?? undefined,
          };
          console.log(`  ✓ Extracted shipping address from session`);
        }
        // Fallback to billing address
        else if (customerDetails?.address) {
          const billingAddr = customerDetails.address;
          shippingAddress = {
            name: customerDetails?.name ?? undefined,
            line1: billingAddr.line1 ?? undefined,
            line2: billingAddr.line2 ?? undefined,
            city: billingAddr.city ?? undefined,
            state: billingAddr.state ?? undefined,
            postal_code: billingAddr.postal_code ?? undefined,
            country: billingAddr.country ?? undefined,
          };
          console.log(`  ℹ Using billing address as fallback`);
        }

        // Extract customer name (prioritize shipping name, then billing name)
        customerName = shippingAddress?.name || customerDetails?.name || undefined;

        // Update the order if we found new information
        const updates: any = {};
        if (customerName && !order.customerName) {
          updates.customerName = customerName;
        }
        if (shippingAddress && !order.shippingAddress) {
          updates.shippingAddress = shippingAddress;
        }

        if (Object.keys(updates).length > 0) {
          await prisma.order.update({
            where: { id: order.id },
            data: updates
          });

          console.log(`  ✓ Updated order with:`);
          if (updates.customerName) {
            console.log(`    - Customer Name: ${updates.customerName}`);
          }
          if (updates.shippingAddress) {
            console.log(`    - Shipping Address: ${updates.shippingAddress.line1}, ${updates.shippingAddress.city}`);
          }
          
          updatedCount++;
        } else {
          console.log(`  ℹ No new information found to update`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`  ✗ Failed to process order ${order.id}:`, error);
        failedCount++;
      }
    }

    console.log('\n═════════════════════════════════════');
    console.log('Summary:');
    console.log(`  Total orders checked: ${ordersNeedingInfo.length}`);
    console.log(`  Orders updated: ${updatedCount}`);
    console.log(`  Orders skipped (no session found): ${skippedCount}`);
    console.log(`  Orders failed: ${failedCount}`);
    console.log('═════════════════════════════════════\n');

  } catch (error) {
    console.error('Error backfilling customer info:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
backfillCustomerInfo()
  .then(() => {
    console.log('✓ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

