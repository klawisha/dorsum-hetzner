/*
  Warnings:

  - You are about to drop the column `paymentStatus` on the `Appointment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "paymentStatus",
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false;
