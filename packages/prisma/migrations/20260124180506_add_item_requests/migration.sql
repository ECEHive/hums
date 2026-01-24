-- CreateEnum
CREATE TYPE "ItemRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ItemRequest" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "requestedItemName" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "ItemRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "requestedById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ItemRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemRequest_requestedById_idx" ON "ItemRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ItemRequest_status_createdAt_idx" ON "ItemRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ItemRequest" ADD CONSTRAINT "ItemRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRequest" ADD CONSTRAINT "ItemRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRequest" ADD CONSTRAINT "ItemRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
