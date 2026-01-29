import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

/**
 * Excuse status values:
 * - pending: Issue has not been reviewed (reviewedAt is null, isExcused is false)
 * - excused: Issue has been excused (isExcused is true)
 * - unexcused: Issue has been reviewed and marked as unexcused (reviewedAt is set, isExcused is false)
 */
export const excuseStatusValues = ["pending", "excused", "unexcused"] as const;
export type ExcuseStatus = (typeof excuseStatusValues)[number];

export const ZListIssuesSchema = z.object({
	periodId: z.number().min(1),
	/** Filter by issue type */
	issueType: z
		.enum(["dropped", "absent", "late", "left_early", "all"])
		.default("all"),
	/**
	 * Filter by excuse status (multi-select).
	 * - pending: Not yet reviewed (reviewedAt is null, isExcused is false)
	 * - excused: Has been excused (isExcused is true)
	 * - unexcused: Reviewed but not excused (reviewedAt is set, isExcused is false)
	 */
	excuseStatus: z
		.array(z.enum(excuseStatusValues))
		.min(1)
		.max(3)
		.refine((values) => new Set(values).size === values.length, {
			message: "excuseStatus values must be unique",
		})
		.default(["pending"]),
	/** Filter by start date (inclusive) - filters by shift occurrence timestamp */
	startDate: z.coerce.date().optional(),
	/** Filter by end date (inclusive) - filters by shift occurrence timestamp */
	endDate: z.coerce.date().optional(),
	/** Search by user name or username */
	search: z.string().max(100).optional(),
	limit: z.number().min(1).max(100).default(50),
	offset: z.number().min(0).default(0),
});

export type TListIssuesSchema = z.infer<typeof ZListIssuesSchema>;

export type TListIssuesOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListIssuesSchema;
};

/**
 * Lists attendance issues that may need admin review.
 * Issues include: dropped shifts, absences, late arrivals, and early departures.
 */
export async function listIssuesHandler(options: TListIssuesOptions) {
	const {
		periodId,
		issueType,
		excuseStatus,
		startDate,
		endDate,
		search,
		limit,
		offset,
	} = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: {
				select: { id: true },
			},
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	// Build the where clause based on issue type
	type AttendanceWhere = {
		shiftOccurrence: {
			shiftSchedule: {
				shiftType: {
					periodId: number;
				};
			};
			timestamp?: {
				gte?: Date;
				lte?: Date;
			};
		};
		OR?: Array<{
			status?: ShiftAttendanceStatus;
			didArriveLate?: boolean;
			didLeaveEarly?: boolean;
		}>;
		AND?: Array<{
			OR?: Array<{
				isExcused?: boolean;
				reviewedAt?: null | { not: null };
			}>;
		}>;
		status?: ShiftAttendanceStatus;
		didArriveLate?: boolean;
		didLeaveEarly?: boolean;
		isExcused?: boolean;
		user?: {
			OR: Array<{
				name?: { contains: string; mode: "insensitive" };
				username?: { contains: string; mode: "insensitive" };
			}>;
		};
	};

	const where: AttendanceWhere = {
		shiftOccurrence: {
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
		},
	};

	// Filter by date range
	if (startDate || endDate) {
		where.shiftOccurrence.timestamp = {};
		if (startDate) {
			where.shiftOccurrence.timestamp.gte = startDate;
		}
		if (endDate) {
			// Set end date to end of day
			const endOfDay = new Date(endDate);
			endOfDay.setHours(23, 59, 59, 999);
			where.shiftOccurrence.timestamp.lte = endOfDay;
		}
	}

	// Filter by issue type
	if (issueType === "all") {
		where.OR = [
			{ status: "dropped" },
			{ status: "absent" },
			{ didArriveLate: true },
			{ didLeaveEarly: true },
		];
	} else if (issueType === "dropped") {
		where.status = "dropped";
	} else if (issueType === "absent") {
		where.status = "absent";
	} else if (issueType === "late") {
		where.didArriveLate = true;
	} else if (issueType === "left_early") {
		where.didLeaveEarly = true;
	}

	// Filter by excuse status (multi-select)
	// Build OR conditions for each selected status
	// Dedupe to handle any edge cases (schema validates uniqueness but be defensive)
	const uniqueExcuseStatus = Array.from(new Set(excuseStatus));
	if (
		uniqueExcuseStatus.length > 0 &&
		uniqueExcuseStatus.length < excuseStatusValues.length
	) {
		const excuseStatusConditions: Array<{
			isExcused?: boolean;
			reviewedAt?: null | { not: null };
		}> = [];

		for (const status of uniqueExcuseStatus) {
			if (status === "pending") {
				// Pending: not excused AND not reviewed
				excuseStatusConditions.push({
					isExcused: false,
					reviewedAt: null,
				});
			} else if (status === "excused") {
				// Excused: isExcused is true
				excuseStatusConditions.push({
					isExcused: true,
				});
			} else if (status === "unexcused") {
				// Unexcused: not excused AND has been reviewed
				excuseStatusConditions.push({
					isExcused: false,
					reviewedAt: { not: null },
				});
			}
		}

		if (excuseStatusConditions.length > 0) {
			where.AND = [{ OR: excuseStatusConditions }];
		}
	}
	// If all 3 statuses are selected, no filter needed

	// Search filter
	if (search?.trim()) {
		where.user = {
			OR: [
				{ name: { contains: search.trim(), mode: "insensitive" } },
				{ username: { contains: search.trim(), mode: "insensitive" } },
			],
		};
	}

	const [total, issues] = await Promise.all([
		prisma.shiftAttendance.count({ where }),
		prisma.shiftAttendance.findMany({
			where,
			orderBy: [
				{ shiftOccurrence: { timestamp: "desc" } },
				{ user: { name: "asc" } },
			],
			skip: offset,
			take: limit,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
				shiftOccurrence: {
					include: {
						shiftSchedule: {
							include: {
								shiftType: {
									select: {
										id: true,
										name: true,
									},
								},
							},
						},
					},
				},
				reviewedBy: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
			},
		}),
	]);

	// Transform to a more useful format
	const formattedIssues = issues.map((issue) => ({
		id: issue.id,
		userId: issue.userId,
		user: issue.user,
		status: issue.status,
		isExcused: issue.isExcused,
		didArriveLate: issue.didArriveLate,
		didLeaveEarly: issue.didLeaveEarly,
		droppedNotes: issue.droppedNotes,
		excuseNotes: issue.excuseNotes,
		reviewedBy: issue.reviewedBy,
		reviewedAt: issue.reviewedAt,
		timeIn: issue.timeIn,
		timeOut: issue.timeOut,
		isMakeup: issue.isMakeup,
		shiftOccurrence: {
			id: issue.shiftOccurrence.id,
			timestamp: issue.shiftOccurrence.timestamp,
			shiftSchedule: {
				id: issue.shiftOccurrence.shiftSchedule.id,
				dayOfWeek: issue.shiftOccurrence.shiftSchedule.dayOfWeek,
				startTime: issue.shiftOccurrence.shiftSchedule.startTime,
				endTime: issue.shiftOccurrence.shiftSchedule.endTime,
				shiftType: issue.shiftOccurrence.shiftSchedule.shiftType,
			},
		},
	}));

	return {
		issues: formattedIssues,
		total,
		period: {
			id: period.id,
			name: period.name,
		},
	};
}
