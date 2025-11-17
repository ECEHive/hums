import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_PREFIX_LENGTH = 8;

export function hashApiTokenValue(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

export function generateApiTokenSecret() {
	const raw = randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
	return {
		rawToken: raw,
		hashedKey: hashApiTokenValue(raw),
		prefix: raw.slice(0, TOKEN_PREFIX_LENGTH),
	};
}
