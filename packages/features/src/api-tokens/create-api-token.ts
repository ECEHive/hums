import { prisma } from "@ecehive/prisma";
import type { ApiTokenDTO } from "./types";
import { toApiTokenDTO } from "./types";
import { generateApiTokenSecret } from "./utils";

export type CreateApiTokenParams = {
	name: string;
	description?: string | null;
	expiresAt?: Date | null;
	createdById?: number | null;
};

export type CreateApiTokenResult = {
	token: string;
	record: ApiTokenDTO;
};

export async function createApiToken(
	params: CreateApiTokenParams,
): Promise<CreateApiTokenResult> {
	const { rawToken, hashedKey, prefix } = generateApiTokenSecret();

	const apiToken = await prisma.apiToken.create({
		data: {
			name: params.name,
			description: params.description,
			prefix,
			hashedKey,
			createdById: params.createdById ?? null,
			expiresAt: params.expiresAt ?? null,
		},
	});

	return {
		token: rawToken,
		record: toApiTokenDTO(apiToken),
	};
}
