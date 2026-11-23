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
 * Fetch all shift schedules in a period with users for balancing checks
 */
export async function getAllSchedulesForBalancing(
	prisma: PrismaClient | PrismaTransaction,
	periodId: number,
	// Balancing only compares schedules of the same type, so callers that know
	// the types involved can skip the rest of the period
	shiftTypeIds?: number[],
) {
	return prisma.shiftSchedule.findMany({
		where: {
			shiftType: { periodId },
			...(shiftTypeIds && { shiftTypeId: { in: shiftTypeIds } }),
		},
		select: {
			id: true,
			shiftTypeId: true,
			dayOfWeek: true,
			startTime: true,
			endTime: true,
			slots: true,
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

const SCHEDULE_LISTING_ORDER = [
	{ shiftType: { name: "asc" } },
	{ shiftType: { location: "asc" } },
	{ dayOfWeek: "asc" },
	{ startTime: "asc" },
] satisfies Prisma.ShiftScheduleOrderByWithRelationInput[];

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
		orderBy: SCHEDULE_LISTING_ORDER,
	});
}

/**
 * Fetch a period's schedules for the registration list. Shift types come from
 * getShiftTypesForRegistration instead of being included on every row.
 */
export async function getSchedulesForRegistration(
	prisma: PrismaClient | PrismaTransaction,
	periodId: number,
) {
	return prisma.shiftSchedule.findMany({
		where: { shiftType: { periodId } },
		select: {
			id: true,
			shiftTypeId: true,
			slots: true,
			dayOfWeek: true,
			startTime: true,
			endTime: true,
			users: { select: { id: true, name: true } },
		},
		orderBy: SCHEDULE_LISTING_ORDER,
	});
}

export async function getShiftTypesForRegistration(
	prisma: PrismaClient | PrismaTransaction,
	periodId: number,
) {
	return prisma.shiftType.findMany({
		where: { periodId },
		include: { roles: { select: { id: true } } },
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
