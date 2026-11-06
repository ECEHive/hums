import type { Prisma } from "@ecehive/prisma";

export interface ActiveSuspension {
	id: number;
	startDate: Date;
	endDate: Date;
	externalNotes: string | null;
}

/** Prisma filter for currently active suspensions (startDate <= at AND endDate > at) */
export function activeSuspensionWhere(at: Date): Prisma.SuspensionWhereInput {
	return {
		startDate: { lte: at },
		endDate: { gt: at },
	};
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
			...activeSuspensionWhere(now),
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
			...activeSuspensionWhere(now),
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
 * Get active suspensions that still need an email notification
 * Returns suspensions where:
 * - emailSentAt is null (email not yet sent)
 * - startDate has passed and endDate has not
 */
export async function getUnnotifiedSuspensions(
	tx: Prisma.TransactionClient,
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
	const suspensions = await tx.suspension.findMany({
		where: {
			emailSentAt: null,
			...activeSuspensionWhere(new Date()),
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
 * Mark emailSentAt for suspensions that have been notified, so emails are not double sent.
 * Returns false if email has already been sent or suspension is not active.
 */
export async function claimSuspensionEmail(
	tx: Prisma.TransactionClient,
	suspensionId: number,
): Promise<boolean> {
	const now = new Date();
	const claimed = await tx.suspension.updateMany({
		where: {
			id: suspensionId,
			emailSentAt: null,
			...activeSuspensionWhere(now),
		},
		data: { emailSentAt: now },
	});
	return claimed.count > 0;
}
