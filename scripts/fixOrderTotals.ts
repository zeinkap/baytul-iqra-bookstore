import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrderTotals() {
  console.log('Starting to fix order totals...\n');

  try {
    // Get all orders where fulfillmentType is 'shipping'
    const shippingOrders = await prisma.order.findMany({
      where: {
        fulfillmentType: 'shipping'
      }
    });

    console.log(`Found ${shippingOrders.length} shipping orders to check.\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    const SHIPPING_COST = 5.00;

    for (const order of shippingOrders) {
      // Calculate what the finalTotal should be
      const expectedFinalTotal = order.total + SHIPPING_COST - order.discountAmount;
      const currentFinalTotal = order.finalTotal;
      
      // Check if finalTotal is incorrect (allowing for floating point precision issues)
      const difference = Math.abs(expectedFinalTotal - currentFinalTotal);
      
      if (difference > 0.01) {
        console.log(`Order ${order.id}:`);
        console.log(`  Subtotal: $${order.total.toFixed(2)}`);
        console.log(`  Discount: $${order.discountAmount.toFixed(2)}`);
        console.log(`  Current Final Total: $${currentFinalTotal.toFixed(2)}`);
        console.log(`  Expected Final Total: $${expectedFinalTotal.toFixed(2)} (with $${SHIPPING_COST.toFixed(2)} shipping)`);
        
        // Update the order
        await prisma.order.update({
          where: { id: order.id },
          data: { finalTotal: expectedFinalTotal }
        });
        
        console.log(`  ✓ Fixed!\n`);
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n═════════════════════════════════════');
    console.log('Summary:');
    console.log(`  Total orders checked: ${shippingOrders.length}`);
    console.log(`  Orders fixed: ${fixedCount}`);
    console.log(`  Orders already correct: ${skippedCount}`);
    console.log('═════════════════════════════════════\n');

  } catch (error) {
    console.error('Error fixing order totals:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixOrderTotals()
  .then(() => {
    console.log('✓ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

