-- Add users.impersonate permission
INSERT INTO "Permission" (name) VALUES ('users.impersonate')
ON CONFLICT (name) DO NOTHING;
