import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newCategories = [
  "Other",
];

async function addCategories() {
  try {
    for (const name of newCategories) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      console.log(`✅ Category "${name}" added (or already exists).`);
    }
  } catch (error) {
    console.error('❌ Error adding categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCategories(); 