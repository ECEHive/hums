-- CreateEnum
CREATE TYPE "LoadBalancingStrategy" AS ENUM ('none', 'round_robin', 'even_distribution');

-- CreateTable
CREATE TABLE "InstantEventType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "durationMinutes" INTEGER NOT NULL,
    "minSchedulers" INTEGER NOT NULL DEFAULT 1,
    "bookingWindowStart" TIMESTAMP(3),
    "bookingWindowEnd" TIMESTAMP(3),
    "loadBalancing" "LoadBalancingStrategy" NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstantEventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstantEventBooking" (
    "id" SERIAL NOT NULL,
    "instantEventTypeId" INTEGER NOT NULL,
    "requestorId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstantEventBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAvailability" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InstantEventTypeSchedulerRoles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InstantEventTypeSchedulerRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstantEventTypeParticipantRoles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InstantEventTypeParticipantRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstantEventTypeRequiredRoles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InstantEventTypeRequiredRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InstantEventBookingSchedulers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_InstantEventBookingSchedulers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "InstantEventBooking_instantEventTypeId_idx" ON "InstantEventBooking"("instantEventTypeId");

-- CreateIndex
CREATE INDEX "InstantEventBooking_requestorId_idx" ON "InstantEventBooking"("requestorId");

-- CreateIndex
CREATE INDEX "InstantEventBooking_startTime_endTime_idx" ON "InstantEventBooking"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "UserAvailability_userId_idx" ON "UserAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvailability_userId_dayOfWeek_startTime_key" ON "UserAvailability"("userId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "_InstantEventTypeSchedulerRoles_B_index" ON "_InstantEventTypeSchedulerRoles"("B");

-- CreateIndex
CREATE INDEX "_InstantEventTypeParticipantRoles_B_index" ON "_InstantEventTypeParticipantRoles"("B");

-- CreateIndex
CREATE INDEX "_InstantEventTypeRequiredRoles_B_index" ON "_InstantEventTypeRequiredRoles"("B");

-- CreateIndex
CREATE INDEX "_InstantEventBookingSchedulers_B_index" ON "_InstantEventBookingSchedulers"("B");

-- AddForeignKey
ALTER TABLE "InstantEventBooking" ADD CONSTRAINT "InstantEventBooking_instantEventTypeId_fkey" FOREIGN KEY ("instantEventTypeId") REFERENCES "InstantEventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantEventBooking" ADD CONSTRAINT "InstantEventBooking_requestorId_fkey" FOREIGN KEY ("requestorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeSchedulerRoles" ADD CONSTRAINT "_InstantEventTypeSchedulerRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "InstantEventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeSchedulerRoles" ADD CONSTRAINT "_InstantEventTypeSchedulerRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeParticipantRoles" ADD CONSTRAINT "_InstantEventTypeParticipantRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "InstantEventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeParticipantRoles" ADD CONSTRAINT "_InstantEventTypeParticipantRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeRequiredRoles" ADD CONSTRAINT "_InstantEventTypeRequiredRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "InstantEventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventTypeRequiredRoles" ADD CONSTRAINT "_InstantEventTypeRequiredRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventBookingSchedulers" ADD CONSTRAINT "_InstantEventBookingSchedulers_A_fkey" FOREIGN KEY ("A") REFERENCES "InstantEventBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstantEventBookingSchedulers" ADD CONSTRAINT "_InstantEventBookingSchedulers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed scheduling permissions
INSERT INTO "Permission" (name) VALUES
  ('scheduling.event_types.list'),
  ('scheduling.event_types.get'),
  ('scheduling.event_types.create'),
  ('scheduling.event_types.update'),
  ('scheduling.event_types.delete'),
  ('scheduling.availability.list'),
  ('scheduling.availability.manage'),
  ('scheduling.bookings.list'),
  ('scheduling.bookings.create'),
  ('scheduling.bookings.cancel'),
  ('scheduling.bookings.manage')
ON CONFLICT (name) DO NOTHING;
