import { prisma } from "@ecehive/prisma";

export async function deleteApiToken(id: number) {
	await prisma.apiToken.delete({ where: { id } });
}
