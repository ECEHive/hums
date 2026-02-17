import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import { createUser } from "./create-user";
import { fetchUserInfo } from "./fetch-user-info";

/**
 * Create, update, and delete system users based on the SYSTEM_USERS environment variable.
 */
export async function updateSystemUsers() {
	// Parse system users list, trim whitespace and map to usernames
	const systemUsers = env.SYSTEM_USERS.split(",")
		.map((email) => {
			const trimmed = email.trim();
			// Handle both email and username formats
			return trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
		})
		.filter(Boolean);

	// Add or update system users in the database
	for (const username of systemUsers) {
		const userInfo = await fetchUserInfo(username);

		// Check if user exists
		const existingUser = await prisma.user.findUnique({
			where: { username: userInfo.username },
		});

		if (existingUser) {
			// Update existing user
			await prisma.user.update({
				where: { username: userInfo.username },
				data: {
					isSystemUser: true,
					name: userInfo.name,
					email: userInfo.email,
				},
			});

			// Persist card number as a credential if available
			if (userInfo.cardNumber) {
				await prisma.credential.upsert({
					where: { value: userInfo.cardNumber },
					update: {},
					create: { value: userInfo.cardNumber, userId: existingUser.id },
				});
			}
		} else {
			// Create new system user using unified function
			const newUser = await createUser({
				username: userInfo.username,
				name: userInfo.name,
				email: userInfo.email,
				isSystemUser: true,
			});

			// Persist card number as a credential if available
			if (userInfo.cardNumber) {
				await prisma.credential.upsert({
					where: { value: userInfo.cardNumber },
					update: {},
					create: { value: userInfo.cardNumber, userId: newUser.id },
				});
			}
		}
	}

	// Remove system user flag from any users that are no longer system users
	await prisma.user.updateMany({
		where: {
			isSystemUser: true,
			username: {
				notIn: systemUsers,
			},
		},
		data: {
			isSystemUser: false,
		},
	});
}
