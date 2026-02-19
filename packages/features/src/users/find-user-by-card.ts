import { getLogger } from "@ecehive/logger";
import { type Prisma, prisma } from "@ecehive/prisma";
import { getUserDataProvider, normalizeCardNumber } from "@ecehive/user-data";
import { TRPCError } from "@trpc/server";
import { credentialPreview, hashCredential } from "../credentials/hash";
import { createUser } from "./create-user";

const logger = getLogger("features:find-user-by-card");

// P2002 is the Prisma error code for unique constraint violation
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

/**
 * Resolve a user from a scanned credential value (e.g. card number).
 *
 * Lookup order:
 *  1. Credential table  – value already associated with a user.
 *  2. External data provider – fetch by card number, create/update user,
 *     then persist a Credential row for future lookups.
 *
 * External HTTP calls are deliberately kept **outside** the Prisma interactive
 * transaction so that a slow provider response cannot cause a transaction
 * timeout (default 5 s).
 */
export async function findUserByCard(cardNumber: string) {
	const provider = getUserDataProvider();
	const normalized = normalizeCardNumber(cardNumber);
	if (!normalized) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid card number",
		});
	}

	// ── Step 1: Quick credential lookup (no transaction needed) ──────────
	const hash = hashCredential(normalized);
	const credential = await prisma.credential.findUnique({
		where: { hash },
		include: { user: true },
	});

	if (credential) {
		logger.debug("Credential found", {
			credentialId: credential.id,
			userId: credential.user.id,
		});
		return credential.user;
	}

	// ── Step 2: External provider lookup (outside transaction) ───────────
	logger.info("Credential miss, querying external provider", {
		normalizedCard: `${normalized.slice(0, 3)}***`,
	});

	const profile = await provider.fetchByCardNumber(normalized);

	if (!profile) {
		logger.warn("External provider returned no match", {
			normalizedCard: `${normalized.slice(0, 3)}***`,
		});
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "No user exists for the provided card",
		});
	}

	logger.info("External provider matched user", {
		username: profile.username,
	});

	// ── Step 3: Create / update user + persist credential (transaction) ──
	return await prisma.$transaction(async (tx) => {
		// Re-check credential inside the transaction to handle a concurrent
		// request that may have already created it while we were calling the
		// provider.
		const existingCred = await tx.credential.findUnique({
			where: { hash },
			include: { user: true },
		});
		if (existingCred) {
			return existingCred.user;
		}

		let user = await tx.user.findUnique({
			where: { username: profile.username },
		});

		if (!user) {
			try {
				user = await createUser(
					{
						username: profile.username,
						name: profile.name,
						email: profile.email,
					},
					{ tx, skipProviderFetch: true },
				);
			} catch (error) {
				if (
					error instanceof Error &&
					"code" in error &&
					(error as { code: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
				) {
					user = await tx.user.findUnique({
						where: { username: profile.username },
					});
					if (!user) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: "User creation race condition - please try again",
						});
					}
				} else {
					throw error;
				}
			}
		} else {
			// Update existing user profile if needed
			const updateData: Prisma.UserUpdateInput = {};
			if (profile.name && profile.name !== user.name) {
				updateData.name = profile.name;
			}
			if (profile.email && profile.email !== user.email) {
				updateData.email = profile.email;
			}

			if (Object.keys(updateData).length > 0) {
				user = await tx.user.update({
					where: { id: user.id },
					data: updateData,
				});
			}
		}

		// Persist credential for the resolved user
		await ensureCredential(tx, user.id, hash, credentialPreview(normalized));

		return user;
	});
}

/**
 * Insert a credential row if one does not already exist.
 * Silently ignores unique-constraint violations (concurrent insert).
 */
async function ensureCredential(
	tx: Prisma.TransactionClient,
	userId: number,
	hash: string,
	preview: string,
): Promise<void> {
	try {
		await tx.credential.upsert({
			where: { hash },
			update: { userId },
			create: { hash, preview, userId },
		});
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as { code: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
		) {
			return;
		}
		throw error;
	}
}
