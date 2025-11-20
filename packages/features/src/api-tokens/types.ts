import type { ApiToken } from "@ecehive/prisma";

export type ApiTokenDTO = Omit<ApiToken, "hashedKey"> & {
	preview: string;
	isExpired: boolean;
};

export function toApiTokenDTO(token: ApiToken): ApiTokenDTO {
	return {
		id: token.id,
		name: token.name,
		description: token.description,
		prefix: token.prefix,
		createdById: token.createdById,
		expiresAt: token.expiresAt,
		lastUsedAt: token.lastUsedAt,
		createdAt: token.createdAt,
		updatedAt: token.updatedAt,
		preview: `${token.prefix}…`,
		isExpired: Boolean(token.expiresAt && token.expiresAt < new Date()),
	};
}
