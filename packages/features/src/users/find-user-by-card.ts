import { type Prisma, prisma } from "@ecehive/prisma";
import { getUserDataProvider, normalizeCardNumber } from "@ecehive/user-data";
import { TRPCError } from "@trpc/server";

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
				user = await tx.user.create({
					data: {
						username: profile.username,
						name: profile.name,
						email: profile.email,
						...(profile.cardNumber ? { cardNumber: profile.cardNumber } : {}),
					},
				});
			}

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

		return user;
	});
}
