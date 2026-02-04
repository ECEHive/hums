-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "hasControlAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_DeviceControlPoints" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_DeviceControlPoints_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DeviceControlPoints_B_index" ON "_DeviceControlPoints"("B");

-- AddForeignKey
ALTER TABLE "_DeviceControlPoints" ADD CONSTRAINT "_DeviceControlPoints_A_fkey" FOREIGN KEY ("A") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceControlPoints" ADD CONSTRAINT "_DeviceControlPoints_B_fkey" FOREIGN KEY ("B") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
