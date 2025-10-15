import { env } from "@ecehive/env";
import { and, notInArray } from "drizzle-orm";
import db from "./drizzle";
import { users } from "./schema";

/**
 * Initialization logic for the database.
 */
export async function initialize() {
	// Create and update all system users
	await db
		.insert(users)
		.values(
			env.SYSTEM_USERS.split(",").map((email) => ({
				name: email.split("@")[0],
				username: email.split("@")[0],
				email,
				isSystemUser: true,
			})),
		)
		.onConflictDoUpdate({
			target: users.email,
			set: { isSystemUser: true },
		});

	// Remove system user flag from any users that are no longer system users
	await db
		.update(users)
		.set({ isSystemUser: false })
		.where(
			and(
				users.isSystemUser,
				notInArray(users.email, env.SYSTEM_USERS.split(",")),
			),
		);
}
