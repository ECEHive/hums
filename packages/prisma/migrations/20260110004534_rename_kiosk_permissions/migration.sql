-- AlterTable
ALTER TABLE "Device" RENAME CONSTRAINT "Kiosk_pkey" TO "Device_pkey";

-- RenameIndex
ALTER INDEX "Kiosk_ipAddress_key" RENAME TO "Device_ipAddress_key";

-- Rename Permissions
UPDATE "Permission" SET "name" = 'devices.create' WHERE "name" = 'kiosks.create';
UPDATE "Permission" SET "name" = 'devices.get' WHERE "name" = 'kiosks.get';
UPDATE "Permission" SET "name" = 'devices.list' WHERE "name" = 'kiosks.list';
UPDATE "Permission" SET "name" = 'devices.update' WHERE "name" = 'kiosks.update';
UPDATE "Permission" SET "name" = 'devices.delete' WHERE "name" = 'kiosks.delete';
