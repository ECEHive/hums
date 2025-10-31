import { db, users } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { fetchUserInfo } from "./fetch-user-info";

export async function createUser(username: string) {
	try {
		// Set basic defaults
		let name = username;
		let email = `${username}@gatech.edu`;

		// Attempt to fetch user information from LDAP
		try {
			const userInfo = await fetchUserInfo(username);
			name = userInfo.name;
			email = userInfo.email;
		} catch (error) {
			// If LDAP fetch fails, proceed with defaults
			console.error("LDAP fetch failed:", error);
		}

		const createUserResponse = await db
			.insert(users)
			.values({
				name,
				username,
				email,
			})
			.returning();

		return createUserResponse[0];
	} catch {
		console.error("User creation failed for username:", username);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create user",
		});
	}
}
