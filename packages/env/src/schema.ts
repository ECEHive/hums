import crypto from "node:crypto";
import z from "zod";

const BaseEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(44830),
	DATABASE_URL: z.url(),
	AUTH_SECRET: z
		.string()
		.default(crypto.randomBytes(64).toString("utf8"))
		.transform((val) => {
			const buffer = Buffer.from(val);
			return new Uint8Array(buffer);
		}),
	AUTH_PROVIDER: z.enum(["CAS", "CAS_PROXIED"]).default("CAS_PROXIED"),
	AUTH_CAS_SERVER: z.url(),
	AUTH_CAS_LOGIN_URL: z.string().url().optional(),
	AUTH_CAS_VALIDATE_URL: z.string().url().optional(),
	AUTH_CAS_LOGOUT_URL: z.string().url().optional(),
	AUTH_CAS_PROXY_URL: z.string().url().optional(),
	SYSTEM_USERS: z
		.string()
		.default("")
		.describe("Comma-separated list of usernames"),
	DATA_PROVIDER: z.string().default("legacy"),
	FALLBACK_EMAIL_DOMAIN: z.string().default("gatech.edu"),
	TZ: z.string().default("America/New_York"),
});

const LegacyProviderSchema = z
	.object({
		DATA_PROVIDER: z.literal("legacy").default("legacy"),
	})
	.and(
		z.object({
			LDAP_HOST: z.string().default("whitepages.gatech.edu"),
			LDAP_BASE_DN: z.string().default("dc=whitepages,dc=gatech,dc=edu"),
		}),
	);

const BuzzApiProviderSchema = z
	.object({
		DATA_PROVIDER: z.literal("buzzapi"),
	})
	.and(
		z.object({
			BUZZAPI_BASE_URL: z.url(),
			BUZZAPI_USER: z.string(),
			BUZZAPI_PASSWORD: z.string(),
		}),
	);

export const ZEnvSchema = z.intersection(
	BaseEnvSchema,
	z.union([LegacyProviderSchema, BuzzApiProviderSchema]),
);

export type TEnvSchema = z.infer<typeof ZEnvSchema>;
