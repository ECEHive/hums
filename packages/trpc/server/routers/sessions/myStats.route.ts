import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZMyStatsSchema = z.object({
	// Optional date range filter
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export type TMyStatsSchema = z.infer<typeof ZMyStatsSchema>;

export type TMyStatsOptions = {
	ctx: TProtectedProcedureContext;
	input: TMyStatsSchema;
};

export async function myStatsHandler(options: TMyStatsOptions) {
	const userId = options.ctx.user.id;
	const { startDate, endDate } = options.input;

	// Build where clause with optional date filters
	const where: {
		userId: number;
		startedAt?: { gte?: Date; lte?: Date };
	} = { userId };

	if (startDate || endDate) {
		where.startedAt = {};
		if (startDate) where.startedAt.gte = startDate;
		if (endDate) where.startedAt.lte = endDate;
	}

	// Get all sessions (completed and active)
	const [allSessions, activeSessions] = await Promise.all([
		prisma.session.findMany({
			where,
			select: {
				id: true,
				startedAt: true,
				endedAt: true,
			},
		}),
		prisma.session.findMany({
			where: {
				...where,
				endedAt: null,
			},
			select: {
				id: true,
				startedAt: true,
			},
		}),
	]);

	// Calculate stats
	const totalSessions = allSessions.length;
	const completedSessions = allSessions.filter((s) => s.endedAt !== null);
	const currentlyActive = activeSessions.length > 0;

	// Calculate total time spent (in milliseconds)
	let totalTimeMs = 0;
	const now = new Date();

	for (const session of allSessions) {
		const start = session.startedAt.getTime();
		const end = session.endedAt ? session.endedAt.getTime() : now.getTime();
		totalTimeMs += end - start;
	}

	// Convert to hours
	const totalHours = totalTimeMs / (1000 * 60 * 60);

	// Calculate average session length for completed sessions
	let averageSessionMs = 0;
	if (completedSessions.length > 0) {
		const completedTimeMs = completedSessions.reduce((sum, session) => {
			if (!session.endedAt) return sum;
			const start = session.startedAt.getTime();
			const end = session.endedAt.getTime();
			return sum + (end - start);
		}, 0);
		averageSessionMs = completedTimeMs / completedSessions.length;
	}

	const averageSessionHours = averageSessionMs / (1000 * 60 * 60);

	// Get most recent session
	const recentSession = allSessions.length > 0 ? allSessions[0] : null;

	return {
		totalSessions,
		totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
		averageSessionHours: Math.round(averageSessionHours * 100) / 100,
		currentlyActive,
		activeSessionCount: activeSessions.length,
		mostRecentSession: recentSession
			? {
					startedAt: recentSession.startedAt,
					endedAt: recentSession.endedAt,
				}
			: null,
	};
}
