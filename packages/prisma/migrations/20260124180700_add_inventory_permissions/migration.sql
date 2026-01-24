-- Add inventory permissions for access control
INSERT INTO "Permission" (name) VALUES
    -- Item management permissions
    ('inventory.items.list'),
    ('inventory.items.get'),
    ('inventory.items.create'),
    ('inventory.items.update'),
    ('inventory.items.delete'),
    
    -- Transaction permissions
    ('inventory.transactions.checkIn'),
    ('inventory.transactions.checkOut'),
    ('inventory.transactions.list'),
    
    -- Snapshot permissions (admin only)
    ('inventory.snapshots.create'),
    ('inventory.snapshots.getCurrentQuantity'),
    
    -- Request permissions
    ('inventory.requests.list'),
    ('inventory.requests.update')
ON CONFLICT (name) DO NOTHING;
