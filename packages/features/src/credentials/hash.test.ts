import { describe, expect, it } from "vitest";
import { credentialPreview, hashCredential } from "./hash";
import { createHmac } from "node:crypto";
import { env } from "@ecehive/env";

describe("hashCredential", () => {
	it("produces a lowercase hex-encoded HMAC-SHA256 hash", () => {
		const result = hashCredential("test-value");
		// Should be 64 hex characters (256 bits)
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces deterministic output for the same input", () => {
		const a = hashCredential("card-12345");
		const b = hashCredential("card-12345");
		expect(a).toBe(b);
	});

	it("produces different output for different inputs", () => {
		const a = hashCredential("card-12345");
		const b = hashCredential("card-67890");
		expect(a).not.toBe(b);
	});

	it("matches Node.js crypto HMAC-SHA256 output (PostgreSQL compatible)", () => {
		// This verifies that Bun.CryptoHasher HMAC output matches
		// what PostgreSQL's encode(hmac(value, secret, 'sha256'), 'hex')
		// would produce, since both use standard HMAC-SHA256.
		const testValues = [
			"123456789",
			"test-credential",
			"A",
			"short",
			"a-much-longer-credential-value-that-might-be-realistic",
		];

		for (const value of testValues) {
			const bunResult = hashCredential(value);
			const nodeResult = createHmac("sha256", env.CREDENTIAL_HMAC_SECRET)
				.update(value)
				.digest("hex");
			expect(bunResult).toBe(nodeResult);
		}
	});
});

describe("credentialPreview", () => {
	it("returns last 4 characters for strings >= 4 chars", () => {
		expect(credentialPreview("123456789")).toBe("6789");
		expect(credentialPreview("abcd")).toBe("abcd");
		expect(credentialPreview("hello world")).toBe("orld");
	});

	it("returns masked value for strings shorter than 4 characters", () => {
		expect(credentialPreview("abc")).toBe("****");
		expect(credentialPreview("ab")).toBe("****");
		expect(credentialPreview("a")).toBe("****");
	});

	it("returns masked value for empty string", () => {
		expect(credentialPreview("")).toBe("****");
	});
});
