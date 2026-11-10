-- AlterTable
ALTER TABLE "ShiftAttendance" ADD COLUMN     "excuseRequestReason" TEXT,
ADD COLUMN     "excuseRequestedAt" TIMESTAMP(3),
ADD COLUMN     "issueEmailSentAt" TIMESTAMP(3);

