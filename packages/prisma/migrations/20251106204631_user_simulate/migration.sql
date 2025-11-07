-- Add users.simulate permission
INSERT INTO "Permission" (name) VALUES ('users.simulate')
ON CONFLICT (name) DO NOTHING;
