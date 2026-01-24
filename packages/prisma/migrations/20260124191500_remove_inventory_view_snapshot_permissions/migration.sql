-- Remove inventory viewing and snapshot query permissions (made public)
DELETE FROM "Permission" WHERE name IN (
  'inventory.items.list',
  'inventory.items.get',
  'inventory.snapshots.getCurrentQuantity'
);
