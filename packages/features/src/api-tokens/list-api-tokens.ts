import { prisma } from "@ecehive/prisma";
import type { ApiTokenDTO } from "./types";
import { toApiTokenDTO } from "./types";

export async function listApiTokens(): Promise<ApiTokenDTO[]> {
	const tokens = await prisma.apiToken.findMany({
		orderBy: { createdAt: "desc" },
	});

	return tokens.map(toApiTokenDTO);
}
