-- AlterTable
ALTER TABLE "ControlPoint" ADD COLUMN     "autoTurnOffEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoTurnOffMinutes" INTEGER;
