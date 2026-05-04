-- AlterTable
ALTER TABLE "ControlPoint" ADD COLUMN     "trainedRoleId" INTEGER,
ADD COLUMN     "trainerRoleId" INTEGER;

-- AddForeignKey
ALTER TABLE "ControlPoint" ADD CONSTRAINT "ControlPoint_trainedRoleId_fkey" FOREIGN KEY ("trainedRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPoint" ADD CONSTRAINT "ControlPoint_trainerRoleId_fkey" FOREIGN KEY ("trainerRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
