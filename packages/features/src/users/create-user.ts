<<<<<<< HEAD
import { db, users } from "@ecehive/drizzle";
=======
import { prisma } from "@ecehive/prisma";
>>>>>>> origin/dev
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

<<<<<<< HEAD
		const createUserResponse = await db
			.insert(users)
			.values({
				name,
				username,
				email,
			})
			.returning();

		if (!createUserResponse[0]) {
=======
		const newUser = await prisma.user.create({
			data: {
				name,
				username,
				email,
			},
		});

		if (!newUser) {
>>>>>>> origin/dev
			console.error(
				"Database insert did not return a user object for username:",
				username,
			);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create user",
			});
		}
<<<<<<< HEAD
		return createUserResponse[0];
=======
		return newUser;
>>>>>>> origin/dev
	} catch {
		console.error("User creation failed for username:", username);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create user",
		});
	}
}
