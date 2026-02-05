-- Remove Security Snapshots functionality
-- Drop the SecuritySnapshot table and SecurityEventType enum

-- Drop foreign key constraints first
ALTER TABLE "SecuritySnapshot" DROP CONSTRAINT IF EXISTS "SecuritySnapshot_deviceId_fkey";
ALTER TABLE "SecuritySnapshot" DROP CONSTRAINT IF EXISTS "SecuritySnapshot_userId_fkey";

-- Drop the SecuritySnapshot table
DROP TABLE IF EXISTS "SecuritySnapshot";

-- Drop the SecurityEventType enum
DROP TYPE IF EXISTS "SecurityEventType";

-- Remove security permissions
DELETE FROM "_PermissionToRole" WHERE "A" IN (SELECT "id" FROM "Permission" WHERE "name" LIKE 'security.%');
DELETE FROM "Permission" WHERE "name" LIKE 'security.%';
