import { type Prisma, prisma } from "@ecehive/prisma";
import { getUserDataProvider, normalizeCardNumber } from "@ecehive/user-data";
import { TRPCError } from "@trpc/server";
import { createUser } from "./create-user";

// P2002 is the Prisma error code for unique constraint violation
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

export async function findUserByCard(cardNumber: string) {
	const provider = getUserDataProvider();
	const normalized = normalizeCardNumber(cardNumber);
	if (!normalized) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Invalid card number",
		});
	}

	return await prisma.$transaction(async (tx) => {
		let user = await tx.user.findUnique({
			where: {
				cardNumber: normalized,
			},
		});

		if (!user) {
			const profile = await provider.fetchByCardNumber(normalized);
			if (!profile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `No user exists for the provided card`,
				});
			}

			user = await tx.user.findUnique({
				where: { username: profile.username },
			});

			if (!user) {
				// Use unified createUser function for new users
				// Pass the transaction client to ensure atomicity
				try {
					user = await createUser(
						{
							username: profile.username,
							name: profile.name,
							email: profile.email,
							cardNumber: profile.cardNumber,
						},
						{ tx },
					);
				} catch (error) {
					// Handle race condition: if another request created the user concurrently,
					// we'll get a unique constraint violation. In this case, fetch the user.
					if (
						error instanceof Error &&
						"code" in error &&
						(error as { code: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
					) {
						// User was created by a concurrent request, try to fetch them
						user = await tx.user.findUnique({
							where: { username: profile.username },
						});
						if (!user) {
							// Also try by card number in case that was the constraint
							user = await tx.user.findUnique({
								where: { cardNumber: normalized },
							});
						}
						if (!user) {
							// If we still can't find the user, something unexpected happened
							throw new TRPCError({
								code: "INTERNAL_SERVER_ERROR",
								message: "User creation race condition - please try again",
							});
						}
					} else {
						// Re-throw other errors
						throw error;
					}
				}
			} else {
				// Update existing user if needed
				const updateData: Prisma.UserUpdateInput = {};
				if (!user.cardNumber || user.cardNumber !== normalized) {
					updateData.cardNumber = normalized;
				}
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
		}

		return user;
	});
}
