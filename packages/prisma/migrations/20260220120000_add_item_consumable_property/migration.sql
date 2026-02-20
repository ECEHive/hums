-- Create a new migration to add isConsumable field to Item
-- This migration corresponds to the update made in schema.prisma

ALTER TABLE "Item" ADD COLUMN "isConsumable" boolean NOT NULL DEFAULT false;
