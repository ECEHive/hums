import { generateToken, validateTicket } from "@ecehive/auth";
import { db, users } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

export const ZLoginSchema = z.object({
	ticket: z.string(),
	service: z.string(),
});

export type TLoginSchema = z.infer<typeof ZLoginSchema>;

export type TLoginOptions = {
	input: TLoginSchema;
};

export async function loginHandler(options: TLoginOptions) {
	const { ticket, service } = options.input;

	const username = await validateTicket(ticket, service);

	if (!username) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Invalid ticket",
		});
	}

	// Find or create the user
	const findUserResponse = await db
		.select()
		.from(users)
		.where(eq(users.username, username));
	let user = findUserResponse[0];

	if (!user) {
		const createUserResponse = await db
			.insert(users)
			.values({
				name: username,
				username: username,
				email: `${username}@gatech.edu`,
			})
			.returning();
		user = createUserResponse[0];

		if (!user) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create user",
			});
		}
	}

	const token = await generateToken(user.id);

	if (!token) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to generate token",
		});
	}

	return { token };
}
