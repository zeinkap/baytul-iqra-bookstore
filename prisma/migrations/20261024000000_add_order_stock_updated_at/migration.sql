-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stockUpdatedAt" TIMESTAMP(3);

-- Paid orders already went through the webhook, which took their stock: mark them so a re-delivered event can't take it again
UPDATE "Order" SET "stockUpdatedAt" = "paidAt" WHERE "paidAt" IS NOT NULL;
