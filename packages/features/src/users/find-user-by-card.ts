import { db, users } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export async function findUserByCard(cardNumber: string) {
	return await db.transaction(async (tx) => {
		// Find user by card id in the database
		let user = await tx
			.select()
			.from(users)
			.where(eq(users.cardNumber, cardNumber))
			.limit(1);

		if (user.length === 0) {
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
			user = await tx
				.select()
				.from(users)
				.where(eq(users.username, username))
				.limit(1);
			if (user.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `No user exists for the provided card`,
				});
			}

			// Update the user's card number in our database
			await tx
				.update(users)
				.set({ cardNumber })
				.where(eq(users.id, user[0].id));
		}

		return user[0];
	});
}
