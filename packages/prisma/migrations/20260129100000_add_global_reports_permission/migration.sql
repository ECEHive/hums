-- Add global reports permission
INSERT INTO "Permission" (name) VALUES
    ('global_reports.generate')
ON CONFLICT (name) DO NOTHING;
