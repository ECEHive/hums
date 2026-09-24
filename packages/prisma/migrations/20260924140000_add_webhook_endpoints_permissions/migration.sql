-- Add webhook endpoints permissions
INSERT INTO "Permission" (name) VALUES
    ('webhookEndpoints.create'),
    ('webhookEndpoints.list'),
    ('webhookEndpoints.update'),
    ('webhookEndpoints.delete')
ON CONFLICT (name) DO NOTHING;
