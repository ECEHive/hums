-- CreateTable
CREATE TABLE "OneTimeAccessCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OneTimeAccessCode_code_key" ON "OneTimeAccessCode"("code");

-- CreateIndex
CREATE INDEX "OneTimeAccessCode_code_expiresAt_idx" ON "OneTimeAccessCode"("code", "expiresAt");
