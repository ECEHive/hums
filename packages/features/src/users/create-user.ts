import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { fetchUserInfo } from "./fetch-user-info";

export async function createUser(username: string) {
	try {
		// Set basic defaults
		let name = username;
		let email = `${username}@gatech.edu`;
		let cardNumber: string | undefined;

		// Attempt to fetch user information from the configured provider
		try {
			const userInfo = await fetchUserInfo(username);
			name = userInfo.name;
			email = userInfo.email;
			cardNumber = userInfo.cardNumber ?? undefined;
		} catch (error) {
			// If fetch fails, proceed with defaults
			console.error("User data fetch failed:", error);
		}

		const newUser = await prisma.user.create({
			data: {
				name,
				username,
				email,
				...(cardNumber ? { cardNumber } : {}),
			},
		});

		if (!newUser) {
			console.error(
				"Database insert did not return a user object for username:",
				username,
			);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create user",
			});
		}
		return newUser;
	} catch {
		console.error("User creation failed for username:", username);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create user",
		});
	}
}
