import type { Prisma, PrismaClient } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

// Type alias for database client (transaction or regular prisma)
type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Check if a user has an active session (staffing or regular)
 * Returns the active session if found, null otherwise
 */
export async function getUserActiveSession(tx: DbClient, userId: number) {
	return await tx.session.findFirst({
		where: {
			userId,
			endedAt: null,
		},
		orderBy: { startedAt: "desc" },
	});
}

/**
 * Verify that a user has an active session before allowing control point operations
 * Throws a TRPCError if the user does not have an active session
 */
export async function requireActiveSession(
	tx: DbClient,
	userId: number,
): Promise<void> {
	const activeSession = await getUserActiveSession(tx, userId);

	if (!activeSession) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"You must have an active session to operate control points. Please tap in at a kiosk first.",
		});
	}
}

/**
 * Get the list of control points that are currently ON and were last turned on by the specified user.
 * This is used to prevent users from ending their session while they have active control points.
 *
 * A control point is considered "active" for a user if:
 * 1. The control point is a SWITCH type (not a DOOR - doors don't have persistent state)
 * 2. The current state is ON (true)
 * 3. The last successful TURN_ON action was performed by this user
 */
export async function getUserActiveControlPoints(tx: DbClient, userId: number) {
	// Find all control points that are currently ON and are SWITCH type
	const activeControlPoints = await tx.controlPoint.findMany({
		where: {
			currentState: true,
			controlClass: "SWITCH",
			isActive: true,
		},
		select: {
			id: true,
			name: true,
			location: true,
			controlLogs: {
				where: {
					action: "TURN_ON",
					success: true,
				},
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					userId: true,
					createdAt: true,
				},
			},
		},
	});

	// Filter to only those where the last TURN_ON was by this user
	const userActivePoints = activeControlPoints.filter((point) => {
		const lastTurnOn = point.controlLogs[0];
		return lastTurnOn && lastTurnOn.userId === userId;
	});

	return userActivePoints.map((point) => ({
		id: point.id,
		name: point.name,
		location: point.location,
	}));
}

/**
 * Check if a user has any active control points (control points that are ON
 * and the user was the last one to turn them on).
 * Returns true if the user has at least one active control point.
 */
export async function hasActiveControlPoints(
	tx: DbClient,
	userId: number,
): Promise<boolean> {
	const activePoints = await getUserActiveControlPoints(tx, userId);
	return activePoints.length > 0;
}

/**
 * Verify that a user can end their session.
 * Throws a TRPCError if the user has any active control points that they need to turn off first.
 *
 * @param tx - Database transaction client
 * @param userId - The user ID to check
 * @throws TRPCError if user has active control points
 */
export async function validateCanEndSession(
	tx: DbClient,
	userId: number,
): Promise<void> {
	const activePoints = await getUserActiveControlPoints(tx, userId);

	if (activePoints.length > 0) {
		const pointNames = activePoints
			.map((p) => (p.location ? `${p.name} (${p.location})` : p.name))
			.join(", ");

		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: `You cannot end your session while you have active control points. Please turn off the following first: ${pointNames}`,
		});
	}
}
