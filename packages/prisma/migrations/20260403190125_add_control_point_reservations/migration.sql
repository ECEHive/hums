-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "ControlPoint" ADD COLUMN     "canBeReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxReservationMinutes" INTEGER;

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "controlPointId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "checkedInAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ControlPointReservationRoles" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ControlPointReservationRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Reservation_controlPointId_startTime_endTime_idx" ON "Reservation"("controlPointId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Reservation_userId_status_idx" ON "Reservation"("userId", "status");

-- CreateIndex
CREATE INDEX "Reservation_status_startTime_idx" ON "Reservation"("status", "startTime");

-- CreateIndex
CREATE INDEX "_ControlPointReservationRoles_B_index" ON "_ControlPointReservationRoles"("B");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_controlPointId_fkey" FOREIGN KEY ("controlPointId") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointReservationRoles" ADD CONSTRAINT "_ControlPointReservationRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointReservationRoles" ADD CONSTRAINT "_ControlPointReservationRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed reservation permissions
INSERT INTO "Permission" ("name") VALUES
  ('control.reservations.list'),
  ('control.reservations.create'),
  ('control.reservations.cancel'),
  ('control.reservations.manage')
ON CONFLICT ("name") DO NOTHING;
