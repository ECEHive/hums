-- AlterEnum
ALTER TYPE "ShiftAttendanceStatus" ADD VALUE 'excused';

-- AlterTable
ALTER TABLE "ShiftAttendance" ADD COLUMN     "excuseNotes" TEXT,
ADD COLUMN     "excusedAt" TIMESTAMP(3),
ADD COLUMN     "excusedById" INTEGER,
ADD COLUMN     "isExcused" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "ShiftAttendance" ADD CONSTRAINT "ShiftAttendance_excusedById_fkey" FOREIGN KEY ("excusedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add shift_attendances.excuse permission for granting attendance excuses
INSERT INTO "Permission" ("name")
VALUES ('shift_attendances.excuse')
ON CONFLICT ("name") DO NOTHING;
