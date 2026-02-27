-- Remove unused inventory transaction permissions

-- Clean up any role associations first
DELETE FROM "_PermissionToRole" WHERE "A" IN (
    SELECT "id" FROM "Permission" WHERE "name" IN (
        'inventory.transactions.checkIn',
        'inventory.transactions.checkOut'
    )
);

-- Delete the permissions themselves
DELETE FROM "Permission" WHERE "name" IN (
    'inventory.transactions.checkIn',
    'inventory.transactions.checkOut'
);
