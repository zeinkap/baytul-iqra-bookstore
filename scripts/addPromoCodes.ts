import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addPromoCodes() {
  try {
    // Sample promo codes
    const promoCodes = [
      {
        code: 'WELCOME10',
        description: 'Welcome discount - 10% off',
        discountType: 'percentage',
        discountValue: 10,
        minimumOrderAmount: 25,
        maxUses: 100,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
      },
      {
        code: 'SAVE5',
        description: 'Save $5 on orders over $50',
        discountType: 'fixed',
        discountValue: 500, // $5.00 in cents
        minimumOrderAmount: 50,
        maxUses: 50,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        isActive: true,
      },
      {
        code: 'RAMADAN20',
        description: 'Ramadan special - 20% off',
        discountType: 'percentage',
        discountValue: 20,
        minimumOrderAmount: 30,
        maxUses: 200,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        isActive: true,
      },
    ];

    for (const promoCode of promoCodes) {
      const existing = await prisma.promoCode.findUnique({
        where: { code: promoCode.code }
      });

      if (!existing) {
        await prisma.promoCode.create({
          data: promoCode
        });
        console.log(`✅ Created promo code: ${promoCode.code}`);
      } else {
        console.log(`⚠️  Promo code already exists: ${promoCode.code}`);
      }
    }

    console.log('\n🎉 Promo codes setup complete!');
    console.log('\nAvailable promo codes:');
    console.log('- WELCOME10: 10% off orders over $25');
    console.log('- SAVE5: $5 off orders over $50');
    console.log('- RAMADAN20: 20% off orders over $30');

  } catch (error) {
    console.error('Error adding promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addPromoCodes(); 