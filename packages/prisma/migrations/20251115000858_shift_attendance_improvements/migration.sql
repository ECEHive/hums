-- AlterTable
ALTER TABLE "ShiftAttendance" ADD COLUMN     "didArriveLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "didLeaveEarly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "droppedNotes" TEXT,
ADD COLUMN     "isMakeup" BOOLEAN NOT NULL DEFAULT false;

-- Set arrived late shifts
UPDATE "ShiftAttendance"
SET "didArriveLate" = true,
    "status" = 'present'
WHERE "status" = 'arrived_late';

-- Set left early shifts
UPDATE "ShiftAttendance"
SET "didLeaveEarly" = true,
    "status" = 'present'
WHERE "status" = 'left_early';

-- AlterEnum
BEGIN;
CREATE TYPE "ShiftAttendanceStatus_new" AS ENUM ('upcoming', 'present', 'absent', 'dropped', 'dropped_makeup');
ALTER TABLE "public"."ShiftAttendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ShiftAttendance" ALTER COLUMN "status" TYPE "ShiftAttendanceStatus_new" USING ("status"::text::"ShiftAttendanceStatus_new");
ALTER TYPE "ShiftAttendanceStatus" RENAME TO "ShiftAttendanceStatus_old";
ALTER TYPE "ShiftAttendanceStatus_new" RENAME TO "ShiftAttendanceStatus";
DROP TYPE "public"."ShiftAttendanceStatus_old";
ALTER TABLE "ShiftAttendance" ALTER COLUMN "status" SET DEFAULT 'absent';
COMMIT;

-- Remove any duplicate attendance records before adding the unique constraint
-- Keep the earliest created record for each (shiftOccurrenceId, userId) pair
DELETE FROM "ShiftAttendance"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "ShiftAttendance"
  GROUP BY "shiftOccurrenceId", "userId"
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAttendance_shiftOccurrenceId_userId_key" ON "ShiftAttendance"("shiftOccurrenceId", "userId");

