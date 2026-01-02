-- Add permission for managing other user sessions
INSERT INTO "Permission" (name) VALUES
    ('sessions.manage')
ON CONFLICT (name) DO NOTHING;
