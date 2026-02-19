import type { ApiToken } from "@ecehive/prisma";

export type ApiTokenDTO = Omit<ApiToken, "hashedKey"> & {
	preview: string;
	isExpired: boolean;
	permissions: { id: number; name: string }[];
};

export function toApiTokenDTO(
	token: ApiToken & { permissions?: { id: number; name: string }[] },
): ApiTokenDTO {
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
		permissions: (token.permissions ?? []).map((p) => ({
			id: p.id,
			name: p.name,
		})),
	};
}
