import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { fetchUserInfo } from "./fetch-user-info";

export type CreateUserOptions = {
	name?: string | null;
	email?: string | null;
	cardNumber?: string | null;
};

export async function createUser(
	username: string,
	options?: CreateUserOptions,
) {
	try {
		// Set basic defaults
		let name = options?.name ?? username;
		let email = options?.email ?? `${username}@${env.FALLBACK_EMAIL_DOMAIN}`;
		let cardNumber: string | undefined = options?.cardNumber ?? undefined;

		// Attempt to fetch user information from the configured provider
		try {
			const userInfo = await fetchUserInfo(username);
			name = userInfo.name ?? name;
			email = userInfo.email ?? email;
			cardNumber = userInfo.cardNumber ?? cardNumber ?? undefined;
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
