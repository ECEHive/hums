-- Add reports permissions
INSERT INTO "Permission" (name) VALUES
    ('reports.generate')
ON CONFLICT (name) DO NOTHING;