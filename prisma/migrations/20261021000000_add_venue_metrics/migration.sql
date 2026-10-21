-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "bookId" TEXT,
    "bookTitle" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION,
    "systemStock" INTEGER NOT NULL,
    "countedStock" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "message" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCount_countedAt_idx" ON "StockCount"("countedAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
