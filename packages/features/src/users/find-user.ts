import { db, users } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export async function findUser(uid: string) {
	try {
		const findUserResponse = await db
			.select()
			.from(users)
			.where(eq(users.username, uid));
		return findUserResponse[0];
	} catch {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to find user",
		});
	}
}
