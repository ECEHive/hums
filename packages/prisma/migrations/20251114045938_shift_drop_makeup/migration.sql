-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShiftAttendanceStatus" ADD VALUE 'dropped';
ALTER TYPE "ShiftAttendanceStatus" ADD VALUE 'dropped_makeup';

-- DropEnum
DROP TYPE "ShiftOccurrenceAssignmentStatus";

-- Add permissions
INSERT INTO "Permission" (name) VALUES
    ('shift_occurrences.pickup'),
    ('shift_occurrences.drop')
ON CONFLICT (name) DO NOTHING;