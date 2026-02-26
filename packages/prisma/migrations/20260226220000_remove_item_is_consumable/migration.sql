-- Remove the old isConsumable column from the Item table now that itemType handles consumable state.
-- This corresponds to the schema change that dropped the field from Item.

ALTER TABLE "Item" DROP COLUMN "isConsumable";
