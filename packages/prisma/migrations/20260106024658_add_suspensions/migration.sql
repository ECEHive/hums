-- CreateTable
CREATE TABLE "Suspension" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "internalNotes" TEXT,
    "externalNotes" TEXT,
    "createdById" INTEGER,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suspension_userId_idx" ON "Suspension"("userId");

-- CreateIndex
CREATE INDEX "Suspension_startDate_endDate_idx" ON "Suspension"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Suspension_emailSentAt_startDate_idx" ON "Suspension"("emailSentAt", "startDate");

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add suspensions permissions
INSERT INTO "Permission" (name) VALUES
    ('suspensions.list'),
    ('suspensions.manage')
ON CONFLICT (name) DO NOTHING;
