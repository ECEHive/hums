-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('regular', 'staffing');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "sessionType" "SessionType" NOT NULL DEFAULT 'regular';

-- Add permissions
INSERT INTO "Permission" (name) VALUES
    ('sessions.list'),
    ('sessions.staffing')
ON CONFLICT (name) DO NOTHING;