-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "category" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInstance" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "serialNumber" TEXT,
    "barcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkout" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "itemInstanceId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_barcode_key" ON "InventoryItem"("barcode");

-- CreateIndex
CREATE INDEX "InventoryItem_barcode_idx" ON "InventoryItem"("barcode");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ItemInstance_serialNumber_key" ON "ItemInstance"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ItemInstance_barcode_key" ON "ItemInstance"("barcode");

-- CreateIndex
CREATE INDEX "ItemInstance_itemId_idx" ON "ItemInstance"("itemId");

-- CreateIndex
CREATE INDEX "ItemInstance_status_idx" ON "ItemInstance"("status");

-- CreateIndex
CREATE INDEX "ItemInstance_barcode_idx" ON "ItemInstance"("barcode");

-- CreateIndex
CREATE INDEX "Checkout_userId_idx" ON "Checkout"("userId");

-- CreateIndex
CREATE INDEX "Checkout_itemId_idx" ON "Checkout"("itemId");

-- CreateIndex
CREATE INDEX "Checkout_itemInstanceId_idx" ON "Checkout"("itemInstanceId");

-- CreateIndex
CREATE INDEX "Checkout_returnedAt_idx" ON "Checkout"("returnedAt");

-- CreateIndex
CREATE INDEX "Checkout_checkedOutAt_idx" ON "Checkout"("checkedOutAt");

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_itemInstanceId_fkey" FOREIGN KEY ("itemInstanceId") REFERENCES "ItemInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
