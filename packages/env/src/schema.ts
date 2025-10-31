import crypto from "node:crypto";
import z from "zod";

export const ZEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(3000),
	DATABASE_URL: z.url(),
	AUTH_SECRET: z
		.string()
		.default(crypto.randomBytes(64).toString("hex"))
		.transform((val) => {
			const buffer = Buffer.from(val, "hex");
			return new Uint8Array(buffer);
		}),
	AUTH_CAS_SERVER: z.url(),
	SYSTEM_USERS: z
		.string()
		.regex(
			/^(\s*|\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b(,\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b)*)$/,
		)
		.default("")
		.describe("Comma-separated list of email addresses"),
	LDAP_HOST: z.string().default("whitepages.gatech.edu"),
	LDAP_BASE_DN: z.string().default("dc=whitepages,dc=gatech,dc=edu"),
});

export type TEnvSchema = z.infer<typeof ZEnvSchema>;
