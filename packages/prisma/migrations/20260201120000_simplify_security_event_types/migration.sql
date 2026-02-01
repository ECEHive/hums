-- Simplify SecurityEventType enum: remove in/out specifiers
-- TAP_IN and TAP_OUT become TAP
-- FACE_ID_LOGIN becomes FACE_ID
-- FACE_ID_ENROLLMENT remains unchanged

-- First, update existing data to use the new values
-- Map TAP_IN and TAP_OUT to a temporary value that won't conflict
UPDATE "SecuritySnapshot" SET "eventType" = 'TAP_IN' WHERE "eventType" = 'TAP_OUT';
UPDATE "SecuritySnapshot" SET "eventType" = 'TAP_IN' WHERE "eventType" = 'TAP_IN';

-- Rename the enum values by creating a new enum and migrating
ALTER TYPE "SecurityEventType" RENAME TO "SecurityEventType_old";

CREATE TYPE "SecurityEventType" AS ENUM ('TAP', 'FACE_ID', 'FACE_ID_ENROLLMENT');

-- Update the column to use the new enum type with value mapping
ALTER TABLE "SecuritySnapshot" 
    ALTER COLUMN "eventType" TYPE "SecurityEventType" 
    USING (
        CASE "eventType"::text
            WHEN 'TAP_IN' THEN 'TAP'::text
            WHEN 'TAP_OUT' THEN 'TAP'::text
            WHEN 'FACE_ID_LOGIN' THEN 'FACE_ID'::text
            WHEN 'FACE_ID_ENROLLMENT' THEN 'FACE_ID_ENROLLMENT'::text
        END
    )::"SecurityEventType";

-- Drop the old enum type
DROP TYPE "SecurityEventType_old";
