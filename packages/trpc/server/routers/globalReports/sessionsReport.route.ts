import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZSessionsReportSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	sessionType: z.enum(["regular", "staffing"]).optional(),
	includeOngoing: z.boolean().optional().default(true),
});

export type TSessionsReportSchema = z.infer<typeof ZSessionsReportSchema>;

export type TSessionsReportOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TSessionsReportSchema;
};

export async function sessionsReportHandler(options: TSessionsReportOptions) {
	const { startDate, endDate, sessionType, includeOngoing } = options.input;

	// Build where clause
	const where: Prisma.SessionWhereInput = {};

	// Date filters
	if (startDate || endDate) {
		where.startedAt = {};
		if (startDate) {
			const sd = new Date(startDate);
			if (!Number.isNaN(sd.getTime())) {
				where.startedAt.gte = sd;
			}
		}
		if (endDate) {
			const ed = new Date(endDate);
			if (!Number.isNaN(ed.getTime())) {
				where.startedAt.lte = ed;
			}
		}
	}

	// Session type filter
	if (sessionType) {
		where.sessionType = sessionType;
	}

	// Exclude ongoing sessions if specified
	if (!includeOngoing) {
		where.endedAt = { not: null };
	}

	const sessions = await prisma.session.findMany({
		where,
		select: {
			id: true,
			sessionType: true,
			startedAt: true,
			endedAt: true,
			user: {
				select: {
					id: true,
					username: true,
					name: true,
					email: true,
				},
			},
		},
		orderBy: [
			{ endedAt: { sort: "desc", nulls: "first" } },
			{ startedAt: "desc" },
		],
	});

	const reports = sessions.map((session) => {
		// Calculate duration in minutes
		let durationMinutes = 0;
		if (session.endedAt) {
			durationMinutes = Math.round(
				(session.endedAt.getTime() - session.startedAt.getTime()) / 60000,
			);
		}

		return {
			id: session.id,
			userId: session.user.id,
			username: session.user.username,
			userName: session.user.name,
			userEmail: session.user.email,
			sessionType: session.sessionType,
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			durationMinutes,
			isOngoing: session.endedAt === null,
		};
	});

	// Calculate summary statistics
	const completedSessions = reports.filter((r) => !r.isOngoing);
	const totalDurationMinutes = completedSessions.reduce(
		(sum, r) => sum + r.durationMinutes,
		0,
	);
	const averageDurationMinutes =
		completedSessions.length > 0
			? Math.round(totalDurationMinutes / completedSessions.length)
			: 0;

	return {
		reports,
		total: reports.length,
		summary: {
			totalSessions: reports.length,
			completedSessions: completedSessions.length,
			ongoingSessions: reports.filter((r) => r.isOngoing).length,
			totalDurationMinutes,
			averageDurationMinutes,
		},
	};
}
