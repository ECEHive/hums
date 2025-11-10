-- CreateTable
CREATE TABLE "Agreement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confirmationText" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAgreement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "agreementId" INTEGER NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAgreement_userId_agreementId_key" ON "UserAgreement"("userId", "agreementId");

-- AddForeignKey
ALTER TABLE "UserAgreement" ADD CONSTRAINT "UserAgreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAgreement" ADD CONSTRAINT "UserAgreement_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add permissions
INSERT INTO "Permission" (name) VALUES
    ('agreements.list'),
    ('agreements.get'),
    ('agreements.create'),
    ('agreements.update'),
    ('agreements.delete')
ON CONFLICT (name) DO NOTHING;
