import type { Prisma } from "@ecehive/prisma";

/**
 * Check if a user has the sessions.staffing permission
 */
export async function checkStaffingPermission(
	tx: Prisma.TransactionClient,
	userId: number,
	isSystemUser: boolean,
): Promise<boolean> {
	if (isSystemUser) return true;

	const permission = await tx.permission.findFirst({
		where: {
			name: "sessions.staffing",
			roles: {
				some: {
					users: {
						some: {
							id: userId,
						},
					},
				},
			},
		},
	});

	return permission !== null;
}

/**
 * Check for missing agreements that a user needs to accept
 */
export async function checkMissingAgreements(
	tx: Prisma.TransactionClient,
	userId: number,
): Promise<
	Array<{
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	}>
> {
	const enabledAgreements = await tx.agreement.findMany({
		where: { isEnabled: true },
		select: {
			id: true,
			title: true,
			content: true,
			confirmationText: true,
		},
	});

	if (enabledAgreements.length === 0) {
		return [];
	}

	const userAgreements = await tx.userAgreement.findMany({
		where: {
			userId,
			agreementId: { in: enabledAgreements.map((a) => a.id) },
		},
		select: { agreementId: true },
	});

	const agreedIds = new Set(userAgreements.map((ua) => ua.agreementId));
	return enabledAgreements.filter((a) => !agreedIds.has(a.id));
}

/**
 * Start a new session for a user.
 * Attendance handling for staffing sessions is performed by the attendance
 * plugin via the `session:started` EventBus event (emitted post-commit).
 */
export async function startSession(
	tx: Prisma.TransactionClient,
	userId: number,
	sessionType: "regular" | "staffing",
	startTime: Date = new Date(),
) {
	const session = await tx.session.create({
		data: {
			userId,
			sessionType,
			startedAt: startTime,
		},
	});

	return session;
}

/**
 * End an existing session.
 * Attendance handling for staffing sessions is performed by the attendance
 * plugin via the `session:ended` EventBus event (emitted post-commit).
 */
export async function endSession(
	tx: Prisma.TransactionClient,
	sessionId: number,
	endTime: Date = new Date(),
) {
	const session = await tx.session.update({
		where: { id: sessionId, endedAt: null },
		data: { endedAt: endTime },
	});

	return session;
}

/**
 * Switch a user's session type (end current, start new)
 */
export async function switchSessionType(
	tx: Prisma.TransactionClient,
	currentSessionId: number,
	newSessionType: "regular" | "staffing",
	switchTime: Date = new Date(),
) {
	// Get current session to access userId and type
	const currentSession = await tx.session.findUnique({
		where: { id: currentSessionId },
		select: { userId: true, sessionType: true },
	});

	if (!currentSession) {
		throw new Error("Session not found");
	}

	// End current session
	const endedSession = await endSession(tx, currentSessionId, switchTime);

	// Start new session
	const newSession = await startSession(
		tx,
		currentSession.userId,
		newSessionType,
		switchTime,
	);

	return { endedSession, newSession };
}

/**
 * Get the current active session for a user
 */
export async function getCurrentSession(
	tx: Prisma.TransactionClient,
	userId: number,
) {
	return await tx.session.findFirst({
		where: {
			userId,
			endedAt: null,
		},
		orderBy: { startedAt: "desc" },
	});
}
