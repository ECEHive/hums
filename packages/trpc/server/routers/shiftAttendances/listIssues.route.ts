import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListIssuesSchema = z.object({
	periodId: z.number().min(1),
	/** Filter by issue type */
	issueType: z
		.enum(["dropped", "absent", "late", "left_early", "all"])
		.default("all"),
	/** Only show unexcused issues */
	unexcusedOnly: z.boolean().default(true),
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
	const { periodId, issueType, unexcusedOnly, search, limit, offset } =
		options.input;

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
		};
		OR?: Array<{
			status?: ShiftAttendanceStatus;
			didArriveLate?: boolean;
			didLeaveEarly?: boolean;
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

	// Filter to only unexcused if requested
	if (unexcusedOnly) {
		where.isExcused = false;
	}

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
				excusedBy: {
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
		excusedBy: issue.excusedBy,
		excusedAt: issue.excusedAt,
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
