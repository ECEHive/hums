import { createHmac } from "node:crypto";
import { env } from "@ecehive/env";

/**
 * Compute an HMAC-SHA256 hash of a credential value.
 *
 * Uses HMAC-SHA256 with the CREDENTIAL_HMAC_SECRET environment variable
 * as the HMAC key. The result is a lowercase hex-encoded string that matches
 * PostgreSQL's `encode(hmac(value, secret, 'sha256'), 'hex')` output.
 */
export function hashCredential(value: string): string {
	return createHmac("sha256", env.CREDENTIAL_HMAC_SECRET)
		.update(value)
		.digest("hex");
}

/**
 * Extract a preview (last 4 characters) from a credential value.
 *
 * For credentials shorter than 4 characters, returns a fixed masked value
 * to avoid leaking the full credential.
 */
export function credentialPreview(value: string): string {
	if (value.length >= 4) {
		return value.slice(-4);
	}

	return "****";
}
