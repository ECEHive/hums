-- Add shift_schedules.manipulate permission
INSERT INTO "Permission" ("name")
VALUES ('shift_schedules.manipulate')
ON CONFLICT ("name") DO NOTHING;
