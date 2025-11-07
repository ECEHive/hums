import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { createUser } from "./create-user";

export async function findUserByCard(cardNumber: string) {
	return await prisma.$transaction(async (tx) => {
		// Find user by card id in the database
		let user = await tx.user.findUnique({
			where: { cardNumber },
		});

		if (!user) {
			// Query SUMS for the username of the card owner
			const response = await fetch(
				`https://sums.gatech.edu/SUMSAPI/rest/API/GetUserNameAndEmailByBuzzCardNumber?BuzzCardNumber=${cardNumber}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `No user exists for the provided card`,
				});
			}

			const data = (await response.json()) as { UserName?: string };
			if (!data || !data.UserName) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `No user exists for the provided card`,
				});
			}

			// Get the username from the response
			// Sample: 'Lemons, Andrew (alemons8)' => 'alemons8'
			const username = /\(([^)]+)\)/.exec(data.UserName)?.[1];
			if (!username) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `No user exists for the provided card`,
				});
			}

			// See if the user exists in our database
			user = await tx.user.findUnique({
				where: { username },
			});

			if (!user) {
				// Create the user as if they had logged in on the client (fetch LDAP info)
				user = await createUser(username);
			}

			// Update (or set) the user's card number in our database
			await tx.user.update({
				where: { id: user.id },
				data: { cardNumber },
			});
		}

		return user;
	});
}
