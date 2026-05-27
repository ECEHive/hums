-- CreateEnum
CREATE TYPE "KioskMode" AS ENUM ('ATTENDANCE', 'CONTROL', 'INVENTORY');

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "kioskMode" "KioskMode";

-- DataMigration: seed kioskMode from legacy access flags
-- Devices with hasKioskAccess=true default to ATTENDANCE mode
UPDATE "Device" SET "kioskMode" = 'ATTENDANCE' WHERE "hasKioskAccess" = true;
-- Devices with hasInventoryAccess=true override to INVENTORY mode (takes precedence)
UPDATE "Device" SET "kioskMode" = 'INVENTORY' WHERE "hasInventoryAccess" = true;
