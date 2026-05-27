import { getLogger } from "@ecehive/logger";
import { prisma, type User } from "@ecehive/prisma";
import { getUserDataProvider, normalizeCardNumber } from "@ecehive/user-data";
import { credentialPreview, hashCredential } from "../credentials/hash";

const logger = getLogger("features:refresh-user-profile");

/**
 * How long a cached user profile is considered fresh.
 *
 * After this TTL has elapsed since `profileSyncedAt`, the next access will
 * trigger a re-fetch from the external identity provider. This keeps
 * affiliation, access card numbers, and other identity attributes up-to-date
 * while avoiding unnecessary provider calls on every request.
 */
export const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns `true` when the user's profile data should be refreshed from the
 * external identity provider.
 *
 * A profile is stale when:
 * - `profileSyncedAt` is `null` (never synced), or
 * - The time since the last sync exceeds `PROFILE_CACHE_TTL_MS`, or
 * - `providerDeleted` is `true` — these users are always re-checked so that
 *   a re-appearing account is reinstated as quickly as possible.
 */
export function isProfileStale(
	user: Pick<User, "profileSyncedAt" | "providerDeleted">,
): boolean {
	if (user.providerDeleted) return true;
	if (!user.profileSyncedAt) return true;
	return Date.now() - user.profileSyncedAt.getTime() > PROFILE_CACHE_TTL_MS;
}

/**
 * Refreshes a user's profile data from the external identity provider if the
 * cached data is stale (older than `PROFILE_CACHE_TTL_MS`).
 *
 * When a refresh occurs:
 * - Name, email, department, and affiliation are updated.
 * - Any new access card numbers are persisted as `Credential` rows.
 * - `profileSyncedAt` is set to the current time.
 *
 * If the provider call fails or returns no data the existing user record is
 * returned unchanged so that a transient network error does not lock users out.
 *
 * The provider HTTP call is deliberately made **outside** any Prisma
 * transaction to avoid exceeding the transaction timeout.
 *
 * @param cardNumber - Optional normalized card number. When provided (e.g. on
 *   a card tap), the provider is queried by card number rather than by
 *   username, so the single card-number lookup already in progress is reused
 *   instead of issuing a separate username-based request.
 * @returns The updated user record, or the original record when no refresh
 *          was needed or the refresh failed.
 */
export async function refreshUserProfileIfStale(
	user: User,
	cardNumber?: string,
): Promise<User> {
	if (!isProfileStale(user)) {
		return user;
	}

	logger.info("User profile is stale, refreshing from external provider", {
		userId: user.id,
		username: user.username,
		profileSyncedAt: user.profileSyncedAt,
	});

	const provider = getUserDataProvider();

	const fetchProfile = () =>
		cardNumber
			? provider.fetchByCardNumber(cardNumber)
			: provider.fetchByUsername(user.username);

	let profile: Awaited<ReturnType<typeof provider.fetchByUsername>>;
	try {
		profile = await fetchProfile();
	} catch (error) {
		logger.warn(
			"Profile refresh failed — keeping existing data to avoid lockout",
			{
				userId: user.id,
				username: user.username,
				error: error instanceof Error ? error.message : String(error),
			},
		);
		return user;
	}

	if (!profile) {
		// The provider returned empty data. This can happen when the upstream
		// directory (e.g. BuzzAPI) times out its own backend and returns a
		// successful-status response with no records. Retry once before treating
		// this as a genuine deletion, so a transient timeout does not lock out
		// users who still exist.
		logger.warn(
			"External provider returned no data for user — retrying before marking as deleted",
			{
				userId: user.id,
				username: user.username,
			},
		);
		try {
			profile = await fetchProfile();
		} catch (retryError) {
			logger.warn(
				"Profile refresh retry also failed — keeping existing data to avoid lockout",
				{
					userId: user.id,
					username: user.username,
					error:
						retryError instanceof Error
							? retryError.message
							: String(retryError),
				},
			);
			return user;
		}
	}

	if (!profile) {
		logger.warn(
			"External provider returned no data for user during refresh — marking as provider-deleted",
			{
				userId: user.id,
				username: user.username,
			},
		);
		// Mark the user as deleted by the provider so access is denied until
		// they reappear. We also record the attempt time so we have an audit
		// trail, but isProfileStale will still return true while providerDeleted
		// is set, ensuring every subsequent login re-checks the provider.
		const deletedUser = await prisma.user.update({
			where: { id: user.id },
			data: { providerDeleted: true, profileSyncedAt: new Date() },
		});
		return deletedUser;
	}

	const updateData: {
		profileSyncedAt: Date;
		providerDeleted: boolean;
		name?: string;
		email?: string;
		department?: string | null;
		affiliation?: string | null;
	} = {
		profileSyncedAt: new Date(),
		// Clear the deleted flag in case the user has reappeared in the provider.
		providerDeleted: false,
	};

	if (profile.name) updateData.name = profile.name;
	if (profile.email) updateData.email = profile.email;
	if (profile.department !== undefined)
		updateData.department = profile.department ?? null;
	// Always sync affiliation so revoked access is reflected promptly.
	updateData.affiliation = profile.affiliation ?? null;

	const updatedUser = await prisma.user.update({
		where: { id: user.id },
		data: updateData,
	});

	// Persist any new card credentials that may have been assigned since last sync.
	if (profile.cardNumbers && profile.cardNumbers.length > 0) {
		for (const card of profile.cardNumbers) {
			const normalized = normalizeCardNumber(card);
			if (!normalized) continue;
			const hash = hashCredential(normalized);
			const preview = credentialPreview(normalized);
			await prisma.credential.upsert({
				where: { hash },
				update: { userId: user.id },
				create: { hash, preview, userId: user.id },
			});
		}
	}

	if (user.providerDeleted) {
		logger.info(
			"Provider-deleted user has reappeared \u2014 access reinstated",
			{
				userId: user.id,
				username: user.username,
				affiliation: updatedUser.affiliation,
			},
		);
	} else {
		logger.info("User profile refreshed successfully", {
			userId: user.id,
			username: user.username,
			affiliation: updatedUser.affiliation,
		});
	}

	return updatedUser;
}
