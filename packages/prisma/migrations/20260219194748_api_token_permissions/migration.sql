-- CreateTable
CREATE TABLE "_ApiTokenToPermission" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ApiTokenToPermission_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ApiTokenToPermission_B_index" ON "_ApiTokenToPermission"("B");

-- AddForeignKey
ALTER TABLE "_ApiTokenToPermission" ADD CONSTRAINT "_ApiTokenToPermission_A_fkey" FOREIGN KEY ("A") REFERENCES "ApiToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiTokenToPermission" ADD CONSTRAINT "_ApiTokenToPermission_B_fkey" FOREIGN KEY ("B") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
