-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedAmount" DOUBLE PRECISION,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "restockedAt" TIMESTAMP(3);
