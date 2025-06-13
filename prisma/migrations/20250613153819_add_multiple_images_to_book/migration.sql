/*
  Warnings:

  - You are about to drop the column `image` on the `Book` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Book" DROP COLUMN "image",
ADD COLUMN     "images" TEXT[];
