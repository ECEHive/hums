import { prisma } from "@ecehive/prisma";

export async function renameApiToken(id: number, name: string) {
	return prisma.apiToken.update({
		where: { id },
		data: { name },
	});
}
