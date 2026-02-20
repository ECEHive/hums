import { type ApiToken, type Permission, prisma } from "@ecehive/prisma";
import { hashApiTokenValue } from "./utils";

export type ApiTokenWithPermissions = ApiToken & {
	permissions: Permission[];
};

export async function verifyApiToken(
	token: string,
): Promise<ApiTokenWithPermissions | null> {
	if (!token) {
		return null;
	}

	const hashedKey = hashApiTokenValue(token);
	const record = await prisma.apiToken.findUnique({
		where: { hashedKey },
		include: { permissions: true },
	});

	if (!record) {
		return null;
	}

	if (record.expiresAt && record.expiresAt < new Date()) {
		return null;
	}

	await prisma.apiToken.update({
		where: { id: record.id },
		data: { lastUsedAt: new Date() },
	});

	return record;
}
