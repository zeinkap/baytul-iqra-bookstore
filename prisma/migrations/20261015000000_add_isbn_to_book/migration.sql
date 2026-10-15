-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "isbn" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");
