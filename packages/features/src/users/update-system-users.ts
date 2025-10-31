import { db, users } from "@ecehive/drizzle";
import { env } from "@ecehive/env";
import { and, notInArray } from "drizzle-orm";
import { fetchUserInfo } from "./fetch-user-info";

/**
 * Create, update, and delete system users based on the SYSTEM_USERS environment variable.
 */
export async function updateSystemUsers() {
	// Parse system users list, trim whitespace and map to usernames
	const systemUsers = env.SYSTEM_USERS.split(",").map((email) => {
		const trimmed = email.trim();
		// Handle both email and username formats
		return trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
	});

	// Add or update system users in the database
	for (const username of systemUsers) {
		const userInfo = await fetchUserInfo(username);
		await db
			.insert(users)
			.values({
				name: userInfo.name,
				username: userInfo.username,
				email: userInfo.email,
				isSystemUser: true,
			})
			.onConflictDoUpdate({
				target: users.email,
				set: { isSystemUser: true },
			});
	}

	// Remove system user flag from any users that are no longer system users
	await db
		.update(users)
		.set({ isSystemUser: false })
		.where(and(users.isSystemUser, notInArray(users.username, systemUsers)));
}
