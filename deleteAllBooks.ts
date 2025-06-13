import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  await prisma.book.deleteMany({});
  console.log('All books deleted.');
  await prisma.$disconnect();
  process.exit(0);
})(); 