import type { Prisma, PrismaClient } from "@ecehive/prisma";

/**
 * Type for Prisma transaction client
 */
export type PrismaTransaction = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Fetch user with their roles
 */
export async function getUserWithRoles(
	prisma: PrismaClient | PrismaTransaction,
	userId: number,
) {
	return prisma.user.findUnique({
		where: { id: userId },
		include: {
			roles: true,
		},
	});
}

/**
 * Fetch all shift schedules the user is registered for
 */
export async function getUserRegisteredSchedules(
	prisma: PrismaClient | PrismaTransaction,
	userId: number,
) {
	return prisma.shiftSchedule.findMany({
		where: {
			users: {
				some: { id: userId },
			},
		},
		select: {
			id: true,
			dayOfWeek: true,
			startTime: true,
			endTime: true,
			shiftType: {
				select: { periodId: true },
			},
		},
	});
}

/**
 * Fetch all shift schedules with users for balancing checks
 */
export async function getAllSchedulesForBalancing(
	prisma: PrismaClient | PrismaTransaction,
) {
	return prisma.shiftSchedule.findMany({
		include: {
			users: { select: { id: true } },
		},
	});
}

/**
 * Fetch shift schedule with related data for registration
 */
export async function getShiftScheduleForRegistration(
	prisma: PrismaClient | PrismaTransaction,
	shiftScheduleId: number,
) {
	return prisma.shiftSchedule.findUnique({
		where: { id: shiftScheduleId },
		include: {
			shiftType: {
				include: {
					roles: true,
				},
			},
			users: { select: { id: true } },
		},
	});
}

/**
 * Fetch shift schedules with availability data for listing
 */
export async function getShiftSchedulesForListing(
	prisma: PrismaClient | PrismaTransaction,
	where: Prisma.ShiftScheduleWhereInput,
) {
	return prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				include: {
					roles: true,
				},
			},
			users: {
				select: { id: true, name: true },
			},
		},
		orderBy: [
			{ shiftType: { name: "asc" } },
			{ shiftType: { location: "asc" } },
			{ dayOfWeek: "asc" },
			{ startTime: "asc" },
		],
	});
}

/**
 * Get period by ID
 */
export async function getPeriodById(
	prisma: PrismaClient | PrismaTransaction,
	periodId: number,
) {
	return prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: {
				select: { id: true },
			},
		},
	});
}
