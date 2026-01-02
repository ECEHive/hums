import { queueEmail } from "@ecehive/email";
import { env } from "@ecehive/env";
import { getLogger } from "@ecehive/logger";
import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { ConfigService } from "../config";
import { fetchUserInfo } from "./fetch-user-info";

const logger = getLogger("features:users");

export type CreateUserData = {
	username: string;
	name?: string | null;
	email?: string | null;
	cardNumber?: string | null;
	isSystemUser?: boolean;
	roleIds?: number[];
};

/**
 * Unified user creation function that handles:
 * - User data normalization and defaults
 * - Database insertion
 * - Welcome email sending (automatically based on config)
 * - Role assignment
 *
 * This is the single source of truth for creating users in the system.
 * All user creation should use this function for consistency.
 */
export async function createUser(data: CreateUserData) {
	try {
		const { username, roleIds, ...providedData } = data;
		let name = providedData.name ?? username;
		let email =
			providedData.email ?? `${username}@${env.FALLBACK_EMAIL_DOMAIN}`;
		let cardNumber: string | undefined = providedData.cardNumber ?? undefined;
		const isSystemUser = providedData.isSystemUser ?? false;

		// Attempt to fetch user information from the configured provider
		// This enriches the user data with info from external systems (LDAP, BuzzAPI, etc.)
		try {
			const userInfo = await fetchUserInfo(username);
			name = userInfo.name ?? name;
			email = userInfo.email ?? email;
			cardNumber = userInfo.cardNumber ?? cardNumber ?? undefined;
		} catch (error) {
			// If fetch fails, proceed with defaults
			logger.warn("User data fetch failed, using defaults", {
				username,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Build the Prisma create data
		const createData: Prisma.UserCreateInput = {
			username,
			name,
			email,
			isSystemUser,
			...(cardNumber ? { cardNumber } : {}),
			...(roleIds && roleIds.length > 0
				? {
						roles: {
							connect: roleIds.map((id) => ({ id })),
						},
					}
				: {}),
		};

		const newUser = await prisma.user.create({
			data: createData,
			include: {
				roles: true,
			},
		});

		if (!newUser) {
			logger.error("Database insert failed for user", {
				username,
			});
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create user",
			});
		}

		// Send welcome email if enabled
		try {
			const welcomeEmailEnabled = await ConfigService.get(
				"email.users.welcome.enabled",
			);

			if (welcomeEmailEnabled) {
				await queueEmail({
					to: newUser.email,
					template: "welcome",
					data: {
						userName: newUser.name,
						username: newUser.username,
						email: newUser.email,
					},
				});
				logger.info("Welcome email queued", { username: newUser.username });
			}
		} catch (error) {
			// Don't fail user creation if email queuing fails
			logger.warn("Failed to queue welcome email", {
				username: newUser.username,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return newUser;
	} catch (error) {
		logger.error("User creation failed", {
			username: data.username,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create user",
		});
	}
}
