import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZSessionActivitySchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

export type TSessionActivitySchema = z.infer<typeof ZSessionActivitySchema>;

export type TSessionActivityOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TSessionActivitySchema;
};

export async function sessionActivityHandler(options: TSessionActivityOptions) {
	const { startDate, endDate } = options.input;

	// Build date filters
	const dateFilter: { startedAt?: { gte?: Date; lte?: Date } } = {};
	if (startDate || endDate) {
		dateFilter.startedAt = {};
		if (startDate) {
			const sd = new Date(startDate);
			if (Number.isNaN(sd.getTime())) {
				throw new Error("Invalid startDate: expected a valid ISO date string");
			}
			dateFilter.startedAt.gte = sd;
		}
		if (endDate) {
			const ed = new Date(endDate);
			if (Number.isNaN(ed.getTime())) {
				throw new Error("Invalid endDate: expected a valid ISO date string");
			}
			dateFilter.startedAt.lte = ed;
		}
	}

	// Get all users with their sessions in the date range
	const usersWithSessions = await prisma.user.findMany({
		where: {
			isSystemUser: false,
		},
		select: {
			id: true,
			name: true,
			username: true,
			sessions: {
				where: {
					...dateFilter,
					endedAt: { not: null }, // Only completed sessions
				},
				select: {
					startedAt: true,
					endedAt: true,
				},
				orderBy: { startedAt: "desc" },
			},
		},
		orderBy: { username: "asc" },
	});

	const reports = usersWithSessions.map((user) => {
		const sessions = user.sessions;
		const totalSessions = sessions.length;

		// Calculate total duration in minutes
		let totalDuration = 0;

		for (const session of sessions) {
			if (session.endedAt) {
				const duration =
					(session.endedAt.getTime() - session.startedAt.getTime()) / 60000; // Convert to minutes
				totalDuration += duration;
			}
		}

		// Sessions are ordered by startedAt DESC, so the first session is the most recent
		const lastSessionDate = sessions.length > 0 ? sessions[0].startedAt : null;

		const averageSessionDuration =
			totalSessions > 0 ? totalDuration / totalSessions : 0;

		return {
			id: user.id,
			name: user.name,
			username: user.username,
			totalSessions,
			totalDuration: Math.round(totalDuration),
			averageSessionDuration: Math.round(averageSessionDuration),
			lastSessionDate,
		};
	});

	// Filter out users with no sessions
	const filteredReports = reports.filter((r) => r.totalSessions > 0);

	return {
		reports: filteredReports,
		total: filteredReports.length,
	};
}
