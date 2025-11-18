-- Backfill empty window values with the period range so the NOT NULL change succeeds
UPDATE "Period"
SET
  "visibleStart" = COALESCE("visibleStart", "start"),
  "visibleEnd" = COALESCE("visibleEnd", "end"),
  "scheduleSignupStart" = COALESCE("scheduleSignupStart", "start"),
  "scheduleSignupEnd" = COALESCE("scheduleSignupEnd", "end"),
  "scheduleModifyStart" = COALESCE("scheduleModifyStart", "start"),
  "scheduleModifyEnd" = COALESCE("scheduleModifyEnd", "end")
WHERE
  "visibleStart" IS NULL
  OR "visibleEnd" IS NULL
  OR "scheduleSignupStart" IS NULL
  OR "scheduleSignupEnd" IS NULL
  OR "scheduleModifyStart" IS NULL
  OR "scheduleModifyEnd" IS NULL;

-- AlterTable
ALTER TABLE "Period" ALTER COLUMN "visibleStart" SET NOT NULL,
ALTER COLUMN "visibleEnd" SET NOT NULL,
ALTER COLUMN "scheduleSignupStart" SET NOT NULL,
ALTER COLUMN "scheduleSignupEnd" SET NOT NULL,
ALTER COLUMN "scheduleModifyStart" SET NOT NULL,
ALTER COLUMN "scheduleModifyEnd" SET NOT NULL;
