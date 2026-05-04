-- Add credentials permissions
INSERT INTO "Permission" (name) VALUES
    ('control.points.universalTrainer')
ON CONFLICT (name) DO NOTHING;
