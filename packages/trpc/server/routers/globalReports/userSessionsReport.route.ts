import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUserSessionsReportSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	sessionType: z.enum(["regular", "staffing"]).optional(),
	filterRoleIds: z.array(z.number()).optional(),
});

export type TUserSessionsReportSchema = z.infer<typeof ZUserSessionsReportSchema>;

export type TUserSessionsReportOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUserSessionsReportSchema;
};

export async function userSessionsReportHandler(
	options: TUserSessionsReportOptions,
) {
	const { startDate, endDate, sessionType, filterRoleIds } = options.input;

	// Build session where clause
	const sessionWhere: Prisma.SessionWhereInput = {
		endedAt: { not: null }, // Only completed sessions
	};

	// Date filters
	if (startDate || endDate) {
		sessionWhere.startedAt = {};
		if (startDate) {
			const sd = new Date(startDate);
			if (!Number.isNaN(sd.getTime())) {
				sessionWhere.startedAt.gte = sd;
			}
		}
		if (endDate) {
			const ed = new Date(endDate);
			if (!Number.isNaN(ed.getTime())) {
				sessionWhere.startedAt.lte = ed;
			}
		}
	}

	// Session type filter
	if (sessionType) {
		sessionWhere.sessionType = sessionType;
	}

	// Build user where clause
	const userWhere: Prisma.UserWhereInput = {};

	// Filter by roles if specified
	if (filterRoleIds && filterRoleIds.length > 0) {
		userWhere.roles = {
			some: {
				id: { in: filterRoleIds },
			},
		};
	}

	// Get users with their sessions
	const users = await prisma.user.findMany({
		where: userWhere,
		select: {
			id: true,
			username: true,
			name: true,
			email: true,
			roles: {
				select: {
					id: true,
					name: true,
				},
				orderBy: { name: "asc" },
			},
			sessions: {
				where: sessionWhere,
				select: {
					id: true,
					sessionType: true,
					startedAt: true,
					endedAt: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	const reports = users.map((user) => {
		const sessions = user.sessions;
		const totalSessions = sessions.length;

		// Calculate totals
		let totalDurationMinutes = 0;
		let regularSessions = 0;
		let staffingSessions = 0;

		for (const session of sessions) {
			if (session.endedAt) {
				const duration =
					(session.endedAt.getTime() - session.startedAt.getTime()) / 60000;
				totalDurationMinutes += duration;

				if (session.sessionType === "regular") {
					regularSessions++;
				} else if (session.sessionType === "staffing") {
					staffingSessions++;
				}
			}
		}

		const averageDurationMinutes =
			totalSessions > 0 ? totalDurationMinutes / totalSessions : 0;

		// Convert to hours for display
		const totalHours = totalDurationMinutes / 60;
		const averageHours = averageDurationMinutes / 60;

		// Get first and last session dates
		const sortedSessions = [...sessions].sort(
			(a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
		);
		const firstSessionDate =
			sortedSessions.length > 0 ? sortedSessions[0].startedAt : null;
		const lastSessionDate =
			sortedSessions.length > 0
				? sortedSessions[sortedSessions.length - 1].startedAt
				: null;

		return {
			id: user.id,
			username: user.username,
			name: user.name,
			email: user.email,
			roles: user.roles.map((r) => r.name).join(", "),
			totalSessions,
			regularSessions,
			staffingSessions,
			totalHours: Math.round(totalHours * 100) / 100,
			averageHours: Math.round(averageHours * 100) / 100,
			firstSessionDate,
			lastSessionDate,
		};
	});

	// Filter out users with no sessions
	const filteredReports = reports.filter((r) => r.totalSessions > 0);

	// Calculate summary statistics
	const totalHoursAll = filteredReports.reduce((sum, r) => sum + r.totalHours, 0);
	const totalSessionsAll = filteredReports.reduce(
		(sum, r) => sum + r.totalSessions,
		0,
	);

	return {
		reports: filteredReports,
		total: filteredReports.length,
		summary: {
			totalUsers: filteredReports.length,
			totalSessions: totalSessionsAll,
			totalHours: Math.round(totalHoursAll * 100) / 100,
			averageSessionsPerUser:
				filteredReports.length > 0
					? Math.round((totalSessionsAll / filteredReports.length) * 100) / 100
					: 0,
			averageHoursPerUser:
				filteredReports.length > 0
					? Math.round((totalHoursAll / filteredReports.length) * 100) / 100
					: 0,
		},
	};
}
