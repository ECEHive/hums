-- Rename Kiosk table to Device
ALTER TABLE "Kiosk" RENAME TO "Device";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "hasDashboardAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasKioskAccess" BOOLEAN NOT NULL DEFAULT true;
