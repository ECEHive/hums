-- CreateEnum
CREATE TYPE "ShiftTypeRoleRequirement" AS ENUM ('disabled', 'all', 'any');

-- CreateEnum
CREATE TYPE "ShiftOccurrenceAssignmentStatus" AS ENUM ('assigned', 'dropped', 'picked_up');

-- CreateEnum
CREATE TYPE "ShiftAttendanceStatus" AS ENUM ('present', 'absent', 'arrived_late', 'left_early');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cardNumber" TEXT,
    "isSystemUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "visibleStart" TIMESTAMP(3),
    "visibleEnd" TIMESTAMP(3),
    "scheduleSignupStart" TIMESTAMP(3),
    "scheduleSignupEnd" TIMESTAMP(3),
    "scheduleModifyStart" TIMESTAMP(3),
    "scheduleModifyEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodException" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftType" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isBalancedAcrossOverlap" BOOLEAN NOT NULL DEFAULT false,
    "isBalancedAcrossDay" BOOLEAN NOT NULL DEFAULT false,
    "isBalancedAcrossPeriod" BOOLEAN NOT NULL DEFAULT false,
    "canSelfAssign" BOOLEAN NOT NULL DEFAULT true,
    "doRequireRoles" "ShiftTypeRoleRequirement" NOT NULL DEFAULT 'disabled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSchedule" (
    "id" SERIAL NOT NULL,
    "shiftTypeId" INTEGER NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftOccurrence" (
    "id" SERIAL NOT NULL,
    "shiftScheduleId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAttendance" (
    "id" SERIAL NOT NULL,
    "shiftOccurrenceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "ShiftAttendanceStatus" NOT NULL DEFAULT 'absent',
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kiosk" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kiosk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoleToShiftType" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RoleToShiftType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ShiftScheduleToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ShiftScheduleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ShiftOccurrenceToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ShiftOccurrenceToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cardNumber_key" ON "User"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSchedule_shiftTypeId_dayOfWeek_startTime_key" ON "ShiftSchedule"("shiftTypeId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOccurrence_shiftScheduleId_timestamp_slot_key" ON "ShiftOccurrence"("shiftScheduleId", "timestamp", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Session_userId_endedAt_key" ON "Session"("userId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Kiosk_ipAddress_key" ON "Kiosk"("ipAddress");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE INDEX "_RoleToShiftType_B_index" ON "_RoleToShiftType"("B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- CreateIndex
CREATE INDEX "_ShiftScheduleToUser_B_index" ON "_ShiftScheduleToUser"("B");

-- CreateIndex
CREATE INDEX "_ShiftOccurrenceToUser_B_index" ON "_ShiftOccurrenceToUser"("B");

-- AddForeignKey
ALTER TABLE "PeriodException" ADD CONSTRAINT "PeriodException_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftType" ADD CONSTRAINT "ShiftType_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOccurrence" ADD CONSTRAINT "ShiftOccurrence_shiftScheduleId_fkey" FOREIGN KEY ("shiftScheduleId") REFERENCES "ShiftSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAttendance" ADD CONSTRAINT "ShiftAttendance_shiftOccurrenceId_fkey" FOREIGN KEY ("shiftOccurrenceId") REFERENCES "ShiftOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAttendance" ADD CONSTRAINT "ShiftAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToShiftType" ADD CONSTRAINT "_RoleToShiftType_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToShiftType" ADD CONSTRAINT "_RoleToShiftType_B_fkey" FOREIGN KEY ("B") REFERENCES "ShiftType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShiftScheduleToUser" ADD CONSTRAINT "_ShiftScheduleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "ShiftSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShiftScheduleToUser" ADD CONSTRAINT "_ShiftScheduleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShiftOccurrenceToUser" ADD CONSTRAINT "_ShiftOccurrenceToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "ShiftOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShiftOccurrenceToUser" ADD CONSTRAINT "_ShiftOccurrenceToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual Seeding

-- Add permissions
INSERT INTO "Permission" (name) VALUES
	-- Period Exceptions
	('period_exceptions.list'),
	('period_exceptions.get'),
	('period_exceptions.create'),
	('period_exceptions.update'),
	('period_exceptions.delete'),

	-- Periods
	('periods.list'),
	('periods.get'),
	('periods.create'),
	('periods.update'),
	('periods.delete'),

	-- Permissions
	('permissions.list'),
	('permissions.get'),

	-- Roles
	('roles.list'),
	('roles.get'),
	('roles.create'),
	('roles.update'),
	('roles.delete'),

	-- Shift Occurrences
	('shift_occurrences.list'),
	('shift_occurrences.get'),

	-- Shift Schedules
	('shift_schedules.list'),
	('shift_schedules.get'),
	('shift_schedules.create'),
	('shift_schedules.update'),
	('shift_schedules.delete'),
    ('shift_schedules.register'),
    ('shift_schedules.unregister'),

	-- Shift Types
	('shift_types.list'),
	('shift_types.get'),
	('shift_types.create'),
	('shift_types.update'),
	('shift_types.delete'),

	-- Users
	('users.list'),
	('users.get'),
	('users.create'),
	('users.update'),

    -- Kiosks
    ('kiosks.list'),
	('kiosks.get'),
	('kiosks.create'),
	('kiosks.update'),
	('kiosks.delete')
ON CONFLICT (name) DO NOTHING;
