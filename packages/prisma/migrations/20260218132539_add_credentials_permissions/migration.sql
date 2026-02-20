-- Add credentials permissions
INSERT INTO "Permission" (name) VALUES
    ('credentials.list'),
    ('credentials.create'),
    ('credentials.delete')
ON CONFLICT (name) DO NOTHING;
