import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export async function findUser(uid: string) {
	try {
		const user = await prisma.user.findUnique({
			where: { username: uid },
		});
		return user ?? null;
	} catch {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to find user",
		});
	}
}
