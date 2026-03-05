-- Create a new migration to add the ItemType enum and itemType column on Item
-- This migration corresponds to the schema updates in packages/prisma/schema.prisma

-- create the enum type
CREATE TYPE "ItemType" AS ENUM ('multiple','single','consumable');

-- add the new column to the Item table with a default value
ALTER TABLE "Item" ADD COLUMN "itemType" "ItemType" NOT NULL DEFAULT 'multiple';
