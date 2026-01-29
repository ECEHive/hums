-- CreateTable
CREATE TABLE "_ItemApprovalRoles" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ItemApprovalRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ItemApprovalRoles_B_index" ON "_ItemApprovalRoles"("B");

-- AddForeignKey
ALTER TABLE "_ItemApprovalRoles" ADD CONSTRAINT "_ItemApprovalRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemApprovalRoles" ADD CONSTRAINT "_ItemApprovalRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
