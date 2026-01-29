/*
  Warnings:

  - You are about to drop the column `excusedAt` on the `ShiftAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `excusedById` on the `ShiftAttendance` table. All the data in the column will be lost.

*/
-- First add the new columns
ALTER TABLE "ShiftAttendance" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ShiftAttendance" ADD COLUMN "reviewedById" INTEGER;

-- Copy existing data from excusedBy/excusedAt to reviewedBy/reviewedAt
-- This preserves the history of who excused records
-- Handle edge cases where excusedAt might be set without excusedById
UPDATE "ShiftAttendance" 
SET "reviewedAt" = "excusedAt", "reviewedById" = "excusedById" 
WHERE "excusedById" IS NOT NULL OR "excusedAt" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ShiftAttendance" DROP CONSTRAINT "ShiftAttendance_excusedById_fkey";

-- Now drop the old columns
ALTER TABLE "ShiftAttendance" DROP COLUMN "excusedAt";
ALTER TABLE "ShiftAttendance" DROP COLUMN "excusedById";

-- AddForeignKey
ALTER TABLE "ShiftAttendance" ADD CONSTRAINT "ShiftAttendance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
