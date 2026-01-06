import type { Prisma } from "@ecehive/prisma";

export interface ActiveSuspension {
	id: number;
	startDate: Date;
	endDate: Date;
	externalNotes: string | null;
}

/**
 * Check if a user has an active suspension
 * An active suspension is one where startDate <= now AND endDate > now
 */
export async function getActiveSuspension(
	tx: Prisma.TransactionClient,
	userId: number,
	at?: Date,
): Promise<ActiveSuspension | null> {
	const now = at ?? new Date();

	const suspension = await tx.suspension.findFirst({
		where: {
			userId,
			startDate: { lte: now },
			endDate: { gt: now },
		},
		select: {
			id: true,
			startDate: true,
			endDate: true,
			externalNotes: true,
		},
		orderBy: { endDate: "desc" },
	});

	return suspension;
}

/**
 * Check if a user is currently suspended
 * Returns true if the user has any active suspension
 */
export async function isUserSuspended(
	tx: Prisma.TransactionClient,
	userId: number,
	at?: Date,
): Promise<boolean> {
	const suspension = await getActiveSuspension(tx, userId, at);
	return suspension !== null;
}

/**
 * Get all active suspensions for a user
 * A user could theoretically have overlapping suspensions
 */
export async function getActiveSuspensions(
	tx: Prisma.TransactionClient,
	userId: number,
	at?: Date,
): Promise<ActiveSuspension[]> {
	const now = at ?? new Date();

	const suspensions = await tx.suspension.findMany({
		where: {
			userId,
			startDate: { lte: now },
			endDate: { gt: now },
		},
		select: {
			id: true,
			startDate: true,
			endDate: true,
			externalNotes: true,
		},
		orderBy: { endDate: "desc" },
	});

	return suspensions;
}

/**
 * Get suspensions that are starting soon and need email notifications
 * Returns suspensions where:
 * - startDate is within the next N minutes
 * - emailSentAt is null (email not yet sent)
 */
export async function getSuspensionsStartingSoon(
	tx: Prisma.TransactionClient,
	withinMinutes: number = 5,
): Promise<
	Array<{
		id: number;
		userId: number;
		startDate: Date;
		endDate: Date;
		externalNotes: string | null;
		user: {
			id: number;
			name: string;
			email: string;
		};
	}>
> {
	const now = new Date();
	const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

	const suspensions = await tx.suspension.findMany({
		where: {
			emailSentAt: null,
			startDate: {
				lte: cutoff,
			},
		},
		select: {
			id: true,
			userId: true,
			startDate: true,
			endDate: true,
			externalNotes: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});

	return suspensions;
}

/**
 * Mark a suspension as having its email sent
 */
export async function markSuspensionEmailSent(
	tx: Prisma.TransactionClient,
	suspensionId: number,
): Promise<void> {
	await tx.suspension.update({
		where: { id: suspensionId },
		data: { emailSentAt: new Date() },
	});
}
