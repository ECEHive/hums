-- Add ticket view permissions
INSERT INTO "Permission" (name) VALUES
    ('tickets.view'),
    ('tickets.types.view')
ON CONFLICT (name) DO NOTHING;
