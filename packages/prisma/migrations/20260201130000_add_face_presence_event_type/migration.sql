-- Add PRESENCE event type for security snapshots
-- This is used when a face is detected but no tap event occurs

-- Add the new PRESENCE value to the enum
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PRESENCE';
