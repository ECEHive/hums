-- Remove Face ID functionality
-- Drop the FaceEnrollment table and remove FACE_ID/FACE_ID_ENROLLMENT from SecurityEventType enum

-- First, update any existing snapshots with FACE_ID or FACE_ID_ENROLLMENT event types to TAP
-- This preserves the data but changes the event type
UPDATE "SecuritySnapshot"
SET "eventType" = 'TAP'
WHERE "eventType" IN ('FACE_ID', 'FACE_ID_ENROLLMENT');

-- Drop the FaceEnrollment table
DROP TABLE IF EXISTS "FaceEnrollment";

-- Remove the faceIdEnabled column from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "faceIdEnabled";

-- Recreate the SecurityEventType enum without FACE_ID and FACE_ID_ENROLLMENT
ALTER TYPE "SecurityEventType" RENAME TO "SecurityEventType_old";

CREATE TYPE "SecurityEventType" AS ENUM ('TAP', 'PRESENCE');

ALTER TABLE "SecuritySnapshot"
    ALTER COLUMN "eventType" TYPE "SecurityEventType"
    USING (
        CASE "eventType"::text
            WHEN 'TAP' THEN 'TAP'::text
            WHEN 'PRESENCE' THEN 'PRESENCE'::text
            ELSE 'TAP'::text
        END
    )::"SecurityEventType";

DROP TYPE "SecurityEventType_old";
